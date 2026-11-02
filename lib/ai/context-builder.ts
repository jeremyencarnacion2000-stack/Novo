'use server';

import { prisma } from '@/lib/prisma';
import { CalendarAggregator } from '@/lib/calendar-aggregator';
import { startOfDay, endOfDay } from 'date-fns';
import { getActiveSignal, type ActiveSignal } from '@/lib/cognitive/active-signal';
import { buildTwinContextSummary, type TwinContextSummary } from '@/lib/cognitive/twin-context';
import { getContextSource, NOVO_CONTEXT_SOURCE, type ContextSource } from '@/lib/ai/source-attribution';
import { getGmailContextForUser, shouldIncludeGmailSignal, type GmailContext } from '@/lib/ai/gmail-context';
import { providerSignalFreshness, type ProviderSignalFreshness } from '@/lib/cognitive/provider-signal-freshness';

const BLOCKED_PROVIDER_STATES = new Set(['disconnected', 'revoked', 'reauth_required', 'error']);
const CONTEXT_LIMITS = { tasks: 15, routines: 10, routineDays: 7, exercisesPerDay: 12, projects: 10 } as const;

export interface CognitiveContext {
    system: {
        timestamp: string;
        timezone: string;
    };
    todaySchedule: {
        title: string;
        time: string;
        source: string;
    }[] | null;
    metrics: {
        focusTimeToday: number | null;
        productivityScore: number | null;
        fatigueEstimate: string;
    };
    state: {
        overdueTasks: number | null;
        activeTasks: number | null;
        activeRoutines: number | null;
        activeProjects: number | null;
        lastInsight?: string | null;
        tasksList?: any[];
        routinesList?: any[];
        projectsList?: any[];
    };
    preferences: {
        language: string;
        theme: string;
        compactMode: boolean;
    };
    activeSignal: ActiveSignal | null;
    twinContext: TwinContextSummary | null;
    /** Canonical durable work state used by Today/Chat/Cognitive surfaces. */
    currentPlan?: { id: string; recommendation?: { id: string; taskId: string | null; title: string; status: string } } | null;
    recentOutcomes?: { id: string; type: string; taskId: string | null; createdAt: string }[];
    activePlugins?: string[];
    /** Connection health is metadata only; it never includes tokens. */
    providerHealth?: {
        provider: string;
        status: string;
        lastSuccessfulSyncAt: string | null;
    }[];
    mailbox?: GmailContext | null;
    /** Recent, privacy-safe provider summaries from the durable signal ledger. */
    externalSignals?: {
        source: string;
        signalType: string;
        label: string;
        observedAt: string;
        reliability: string;
        freshness: ProviderSignalFreshness;
    }[];
    /** A short, user-entered work note that is visible to the Twin only by consent and expires quickly. */
    currentWorkContexts?: {
        project: string | null;
        focus: string;
        source: string;
        reliability: 'user_reported';
        status: 'active';
        observedAt: string;
        expiresAt: string;
    }[];
    sources: ContextSource[];
    retrieval?: { status: 'complete' | 'partial' | 'unavailable'; unavailable: string[] };
    contextWindow?: typeof CONTEXT_LIMITS;
}

export interface UserContext {
    summary: string; // The physical string injected into the prompt
    structured: CognitiveContext;
}

export async function buildUserContext(userId: string, options?: {
    twinMode?: boolean;
    includeGmail?: boolean;
    gmailRequest?: { message: string; history?: Array<{role: string; content: string}>; signal?: AbortSignal };
    contextAccess?: { personal: boolean; integrations: boolean; twin?: boolean; development?: boolean; currentWorkContext?: boolean; deviceActivityRead?: boolean };
}): Promise<UserContext> {
    try {
        const personal = options?.contextAccess?.personal ?? true;
        const integrations = options?.contextAccess?.integrations ?? true;
        const twin = options?.contextAccess?.twin ?? personal;
        const development = options?.contextAccess?.development ?? integrations;
        const currentWorkContext = options?.contextAccess?.currentWorkContext ?? personal;
        const deviceActivityRead = options?.contextAccess?.deviceActivityRead ?? personal;
        const now = new Date();
        const start = startOfDay(now);
        const end = endOfDay(now);
        const signalHorizon = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        // Resolve exclusions before any source-specific query, not after fetching
        // forbidden content. Omitted options preserve the web's existing access.
        const signalSourcePreferences = personal || integrations || development || currentWorkContext || deviceActivityRead ? await prisma.novoSignalSourcePreference.findMany({
            where: { userId, excludedAt: { not: null } }, select: { source: true },
        }) : [];
        const excludedSignalSources = new Set(signalSourcePreferences.map((item) => item.source));
        const unavailable = new Set<string>();
        const read = async <T, F>(field: string, operation: () => PromiseLike<T>, fallback: F): Promise<T | F> => {
            try { return await operation(); }
            catch { unavailable.add(field); return fallback; }
        };
        const integrationSources = [...(integrations ? ['gmail','notion','todoist','slack','calendar'] : []),
            ...(development ? ['github','vercel'] : [])].filter(source => !excludedSignalSources.has(source));
        const codexContextRead = (development || currentWorkContext) && !excludedSignalSources.has('codex');
        const signalSources = [...integrationSources, ...(codexContextRead ? ['codex'] : []), ...(deviceActivityRead && !excludedSignalSources.has('device') ? ['device'] : [])];
        const checklistSources = integrationSources.filter(source => source === 'notion' || source === 'todoist');
        const calendarSources = [...(personal ? ['novo','project','school','routine','habit','business','holidays'] : []),
            ...(integrationSources.includes('calendar') ? ['google'] : []), ...(checklistSources.length === 2 ? ['checklist'] : [])];

        const [
            settings,
            snapshot,
            taskCount,
            overdueTaskCount,
            routineCount,
            projectCount,
            todayEvents,
            tasksList,
            routinesList,
            projectsList,
            activeSignal,
            checklistItems,
            integrationAccounts,
            currentPlan,
            recentOutcomes,
            mailbox,
            externalSignalRows,
            currentWorkContextRow,
            twinContext,
        ] = await Promise.all([
            personal ? read('preferences', () => prisma.userSettings.findUnique({ where: { userId } }), null) : null,
            personal ? read('metrics', () => prisma.userCognitiveSnapshot.findUnique({ where: { userId } }), null) : null,
            personal ? read('state.activeTasks', () => prisma.task.count({ where: { userId, status: { in: ['todo', 'in-progress'] } } }), null) : 0,
            personal ? read('state.overdueTasks', () => prisma.task.count({
                where: {
                    userId,
                    status: { in: ['todo', 'in-progress'] },
                    dueDate: { lt: new Date().toISOString() } // simplified check
                }
            }), null) : 0,
            personal ? read('state.activeRoutines', () => prisma.routine.count({ where: { userId, isActive: true } }), null) : 0,
            personal ? read('state.activeProjects', () => prisma.project.count({ where: { userId, status: 'in-progress' } }), null) : 0,
            calendarSources.length ? read('todaySchedule', () => CalendarAggregator.getEventsForRange(userId, start, end, calendarSources, () => { unavailable.add('todaySchedule'); }), null) : [],
            personal ? read('state.tasksList', () => prisma.task.findMany({
                where: { userId, status: { in: ['todo', 'in-progress'] } },
                orderBy: { updatedAt: 'desc' },
                take: CONTEXT_LIMITS.tasks
            }), []) : [],
            personal ? read('state.routinesList', () => prisma.routine.findMany({
                where: { userId, isActive: true },
                orderBy: { updatedAt: 'desc' },
                take: CONTEXT_LIMITS.routines,
                select: {
                    id: true, name: true, description: true, timeOfDay: true, duration: true,
                    scheduledTime: true, daysOfWeek: true, objective: true, frequency: true,
                    level: true, tempo: true, method: true,
                    days: {
                        take: CONTEXT_LIMITS.routineDays,
                        select: {
                            id: true, name: true, weekday: true, order: true,
                            exercises: {
                                orderBy: { order: 'asc' },
                                take: CONTEXT_LIMITS.exercisesPerDay,
                                select: { id: true, name: true, muscleGroup: true, sets: true, reps: true, tempo: true, notes: true, order: true },
                            }
                        },
                        orderBy: { order: 'asc' }
                    }
                }
            }), []) : [],
            personal ? read('state.projectsList', () => prisma.project.findMany({
                where: { userId, status: 'in-progress' },
                orderBy: { updatedAt: 'desc' },
                take: CONTEXT_LIMITS.projects
            }), []) : [],
            personal && integrations ? read('activeSignal', () => getActiveSignal(userId), null) : null,
            checklistSources.length ? read('checklist', () => prisma.checklistItem.findMany({
                where: { userId, completed: false, source: { in: checklistSources } },
                take: 15
            }), []) : [],
            integrationSources.length ? read('providerHealth', () => prisma.integrationAccount.findMany({
                where: { userId, provider: { in: integrationSources } },
                select: { provider: true, createdAt: true, syncStatus: true, lastSuccessfulSyncAt: true }
            }), []) : [],
            personal ? read('currentPlan', () => prisma.actionPlan.findFirst({ where: { userId, status: 'active' }, orderBy: { createdAt: 'desc' }, include: { actions: { where: { status: { in: ['proposed', 'accepted', 'modified', 'started'] } }, orderBy: { priority: 'desc' }, take: 1 } } }), null) : null,
            personal ? read('recentOutcomes', () => prisma.outcomeEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 12, include: { recommendedAction: { select: { taskId: true } } } }), []) : [],
            integrationSources.includes('gmail') && options?.includeGmail ? read('mailbox', () => getGmailContextForUser(userId, options.gmailRequest), { status: 'unavailable' as const, messages: [] }) : null,
            signalSources.length ? read('externalSignals', () => prisma.novoSignalLedger.findMany({
                where: {
                    userId,
                    excludedAt: null,
                    observedAt: { gte: signalHorizon },
                    source: { in: signalSources },
                },
                orderBy: { observedAt: 'desc' },
                take: 20,
                select: { source: true, signalType: true, label: true, observedAt: true, reliability: true },
            }), []) : [],
            currentWorkContext && !excludedSignalSources.has('work_context') ? read('currentWorkContexts', () => prisma.companionWorkContext.findFirst({
                where: { userId, status: 'active', expiresAt: { gt: now } },
                orderBy: { updatedAt: 'desc' },
                select: { projectLabel: true, focusSummary: true, source: true, status: true, observedAt: true, expiresAt: true },
            }), null) : null,
            // Twin consent is independent of personal task/schedule access.
            options?.twinMode && twin ? read('twinContext', () => buildTwinContextSummary(userId), null) : null,
        ]);
        if (mailbox?.status === 'unavailable') unavailable.add('mailbox');

        // Aggregate Twin data has its own consent boundary; it must not imply
        // permission to load task, routine, schedule, or planning records.
        // This builder never fetches provider credentials or provider records.
        const externalSignals = externalSignalRows
            .filter((item) => !excludedSignalSources.has(item.source))
            .filter((item) => item.source !== 'gmail' || shouldIncludeGmailSignal(
                options?.includeGmail === true,
                providerSignalFreshness(item.observedAt, now),
            ))
            .map((item) => ({
                source: item.source,
                signalType: item.signalType,
                label: item.label,
                observedAt: item.observedAt.toISOString(),
                reliability: item.reliability,
                freshness: providerSignalFreshness(item.observedAt, now),
            }));
        const currentWorkContexts = currentWorkContextRow ? [{
            project: currentWorkContextRow.projectLabel,
            focus: currentWorkContextRow.focusSummary,
            source: currentWorkContextRow.source,
            reliability: 'user_reported' as const,
            status: 'active' as const,
            observedAt: currentWorkContextRow.observedAt.toISOString(),
            expiresAt: currentWorkContextRow.expiresAt.toISOString(),
        }] : [];
        const contextActiveSignal = options?.includeGmail
            && activeSignal?.platform === 'gmail'
            ? null
            : activeSignal;

        const combinedTasks = [
            ...tasksList,
            ...checklistItems.map(c => ({
                id: c.id,
                title: c.text,
                status: 'todo',
                priority: c.priority,
                source: c.source,
                dueDate: c.dueDate
            }))
        ];

        // These are the sources that were actually placed in the prompt. A
        // connected account alone is not cited: it must have contributed a
        // synced record, calendar event, or active signal to this response.
        const sourceById = new Map<string, ContextSource>([[NOVO_CONTEXT_SOURCE.id, NOVO_CONTEXT_SOURCE]]);
        const addSource = (provider?: string | null) => {
            if (!provider) return;
            const source = getContextSource(provider);
            if (source) sourceById.set(source.id, source);
        };
        checklistItems.forEach((item) => addSource(item.source));
        todayEvents?.forEach((event: any) => addSource(event.source));
        addSource((contextActiveSignal as any)?.metadata?.source);
        if (mailbox?.status === 'available') addSource('gmail');
        externalSignals.forEach((signal) => addSource(signal.source));
        if (currentWorkContexts.length) addSource('work_context');

        const structuredContext: CognitiveContext = {
            system: {
                timestamp: now.toISOString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            todaySchedule: todayEvents?.map((e: any) => ({
                title: e.title,
                time: e.allDay ? 'All Day' : e.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                source: e.source
            })) ?? null,
            metrics: {
                focusTimeToday: unavailable.has('metrics') ? null : snapshot?.focusTimeToday ?? 0,
                productivityScore: unavailable.has('metrics') ? null : snapshot?.productivityScore ?? 0,
                // A persisted legacy string is an unverified model inference,
                // not a physiological observation. Absence must stay absent.
                fatigueEstimate: snapshot?.fatigueEstimate || 'unavailable',
            },
            state: {
                overdueTasks: overdueTaskCount,
                activeTasks: taskCount === null || unavailable.has('checklist') ? null : taskCount + checklistItems.length,
                activeRoutines: routineCount,
                activeProjects: projectCount,
                lastInsight: snapshot?.lastInsightGeneratedAt ? snapshot.lastInsightGeneratedAt.toISOString() : null,
                tasksList: combinedTasks,
                routinesList,
                projectsList
            },
            preferences: {
                language: settings?.language || 'en',
                theme: settings?.theme || 'system',
                compactMode: settings?.compactMode || false,
            },
            activeSignal: contextActiveSignal,
            twinContext,
            currentPlan: currentPlan ? { id: currentPlan.id, recommendation: currentPlan.actions[0] ? { id: currentPlan.actions[0].id, taskId: currentPlan.actions[0].taskId, title: currentPlan.actions[0].title, status: currentPlan.actions[0].status } : undefined } : null,
            recentOutcomes: recentOutcomes.map((outcome) => ({ id: outcome.id, type: outcome.type, taskId: outcome.recommendedAction?.taskId ?? null, createdAt: outcome.createdAt.toISOString() })),
            activePlugins: [...new Set([
                ...(integrationAccounts || [])
                    .filter((account) => !BLOCKED_PROVIDER_STATES.has(String(account.syncStatus ?? '').toLowerCase()))
                    .map((account) => account.provider),
                ...(mailbox?.status === 'available' ? ['gmail'] : []),
            ])],
            providerHealth: [
                ...(integrationAccounts || []).map((account) => ({
                    provider: account.provider,
                    status: String(account.syncStatus ?? 'connected'),
                    lastSuccessfulSyncAt: account.lastSuccessfulSyncAt?.toISOString() ?? null,
                })),
                ...(mailbox ? [{
                    provider: 'gmail',
                    status: mailbox.status,
                    lastSuccessfulSyncAt: mailbox.status === 'available' ? now.toISOString() : null,
                }] : []),
            ],
            mailbox,
            externalSignals,
            ...(currentWorkContext && !excludedSignalSources.has('work_context') ? { currentWorkContexts } : {}),
            sources: Array.from(sourceById.values()),
            retrieval: { status: unavailable.size ? 'partial' : 'complete', unavailable: [...unavailable] },
            contextWindow: CONTEXT_LIMITS,
        };

        const summary = (unavailable.size ? 'Some context could not be retrieved. Fields in retrieval.unavailable are unknown or incomplete, not empty or zero. Do not invent missing data or ask for reauthorization without an explicit provider authorization status.\n' : '') + JSON.stringify(structuredContext);

        return {
            summary,
            structured: structuredContext
        };
    } catch {
        // Errors here can include provider/database diagnostics. Preserve the
        // resilient context fallback without sending raw details to logs.
        console.error('[Context Builder] Context retrieval failed.');

        // Fallback simple context
        const fallback: CognitiveContext = {
            system: { timestamp: new Date().toISOString(), timezone: 'UTC' },
            todaySchedule: null,
            metrics: { focusTimeToday: null, productivityScore: null, fatigueEstimate: 'unavailable' },
            state: { overdueTasks: null, activeTasks: null, activeRoutines: null, activeProjects: null },
            preferences: { language: 'en', theme: 'system', compactMode: false },
            activeSignal: null,
            twinContext: null,
            currentPlan: null,
            recentOutcomes: [],
            providerHealth: [],
            mailbox: null,
            externalSignals: [],
            sources: [],
            retrieval: { status: 'unavailable', unavailable: ['all'] },
        };

        return {
            summary: 'Context is unavailable. Do not interpret missing information as an empty account or zero activity.\n' + JSON.stringify(fallback),
            structured: fallback
        };
    }
}

export async function buildMinimalContext(userId: string): Promise<string> {
    try {
        const [taskCount, routineCount] = await Promise.all([
            prisma.task.count({ where: { userId, status: 'todo' } }),
            prisma.routine.count({ where: { userId, isActive: true } }),
        ]);

        return `Usuario tiene ${taskCount} tareas pendientes y ${routineCount} rutinas activas.`;
    } catch (error) {
        return '';
    }
}
