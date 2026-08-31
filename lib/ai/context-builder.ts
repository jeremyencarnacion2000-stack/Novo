'use server';

import { prisma } from '@/lib/prisma';
import { User, UserSettings, UserCognitiveSnapshot } from '@prisma/client';
import { CalendarAggregator } from '@/lib/calendar-aggregator';
import { startOfDay, endOfDay } from 'date-fns';
import { getActiveSignal, type ActiveSignal } from '@/lib/cognitive/active-signal';
import { buildTwinContextSummary, type TwinContextSummary } from '@/lib/cognitive/twin-context';
import { getContextSource, NOVO_CONTEXT_SOURCE, type ContextSource } from '@/lib/ai/source-attribution';
import { getGmailContextForUser, type GmailContext } from '@/lib/ai/gmail-context';
import { providerSignalFreshness, type ProviderSignalFreshness } from '@/lib/cognitive/provider-signal-freshness';

const BLOCKED_PROVIDER_STATES = new Set(['disconnected', 'revoked', 'reauth_required', 'error']);

export interface CognitiveContext {
    system: {
        timestamp: string;
        timezone: string;
    };
    todaySchedule: {
        title: string;
        time: string;
        source: string;
    }[];
    metrics: {
        focusTimeToday: number;
        productivityScore: number;
        fatigueEstimate: string;
    };
    state: {
        overdueTasks: number;
        activeTasks: number;
        activeRoutines: number;
        activeProjects: number;
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
    sources: ContextSource[];
}

export interface UserContext {
    summary: string; // The physical string injected into the prompt
    structured: CognitiveContext;
}

export async function buildUserContext(userId: string, options?: { twinMode?: boolean; includeGmail?: boolean }): Promise<UserContext> {
    try {
        const now = new Date();
        const start = startOfDay(now);
        const end = endOfDay(now);
        const signalHorizon = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

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
            signalSourcePreferences,
        ] = await Promise.all([
            prisma.userSettings.findUnique({ where: { userId } }),
            prisma.userCognitiveSnapshot.findUnique({ where: { userId } }),
            prisma.task.count({ where: { userId, status: { in: ['todo', 'in-progress'] } } }),
            prisma.task.count({
                where: {
                    userId,
                    status: { in: ['todo', 'in-progress'] },
                    dueDate: { lt: new Date().toISOString() } // simplified check
                }
            }),
            prisma.routine.count({ where: { userId, isActive: true } }),
            prisma.project.count({ where: { userId, status: 'in-progress' } }),
            CalendarAggregator.getEventsForRange(userId, start, end),
            prisma.task.findMany({
                where: { userId, status: { in: ['todo', 'in-progress'] } },
                orderBy: { updatedAt: 'desc' },
                take: 15
            }),
            prisma.routine.findMany({
                where: { userId, isActive: true },
                include: {
                    days: {
                        include: {
                            exercises: {
                                orderBy: { order: 'asc' }
                            }
                        },
                        orderBy: { order: 'asc' }
                    }
                }
            }),
            prisma.project.findMany({
                where: { userId, status: 'in-progress' },
                orderBy: { updatedAt: 'desc' },
                take: 10
            }),
            getActiveSignal(userId),
            prisma.checklistItem.findMany({
                where: { userId, completed: false, source: { in: ['notion', 'todoist'] } },
                take: 15
            }),
            prisma.integrationAccount.findMany({
                where: { userId },
                select: { provider: true, createdAt: true, syncStatus: true, lastSuccessfulSyncAt: true }
            }),
            prisma.actionPlan.findFirst({ where: { userId, status: 'active' }, orderBy: { createdAt: 'desc' }, include: { actions: { where: { status: { in: ['proposed', 'accepted', 'modified', 'started'] } }, orderBy: { priority: 'desc' }, take: 1 } } }),
            prisma.outcomeEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 12, include: { recommendedAction: { select: { taskId: true } } } }),
            options?.includeGmail ? getGmailContextForUser(userId) : Promise.resolve(null),
            prisma.novoSignalLedger.findMany({
                where: {
                    userId,
                    excludedAt: null,
                    observedAt: { gte: signalHorizon },
                    source: { in: ['gmail', 'notion', 'todoist', 'slack', 'github', 'calendar'] },
                },
                orderBy: { observedAt: 'desc' },
                take: 20,
                select: { source: true, signalType: true, label: true, observedAt: true, reliability: true },
            }),
            prisma.novoSignalSourcePreference.findMany({
                where: { userId, excludedAt: { not: null } },
                select: { source: true },
            }),
        ]);

        const twinContext = options?.twinMode ? await buildTwinContextSummary(userId) : null;
        const excludedSignalSources = new Set(signalSourcePreferences.map((item) => item.source));
        const externalSignals = externalSignalRows
            .filter((item) => !excludedSignalSources.has(item.source))
            .map((item) => ({
                source: item.source,
                signalType: item.signalType,
                label: item.label,
                observedAt: item.observedAt.toISOString(),
                reliability: item.reliability,
                freshness: providerSignalFreshness(item.observedAt, now),
            }));

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
        todayEvents.forEach((event: any) => addSource(event.source));
        addSource((activeSignal as any)?.metadata?.source);
        if (mailbox?.status === 'available') addSource('gmail');
        externalSignals.forEach((signal) => addSource(signal.source));

        const structuredContext: CognitiveContext = {
            system: {
                timestamp: now.toISOString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            todaySchedule: todayEvents.map((e: any) => ({
                title: e.title,
                time: e.allDay ? 'All Day' : e.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                source: e.source
            })),
            metrics: {
                focusTimeToday: snapshot?.focusTimeToday || 0,
                productivityScore: snapshot?.productivityScore || 0,
                // A persisted legacy string is an unverified model inference,
                // not a physiological observation. Absence must stay absent.
                fatigueEstimate: snapshot?.fatigueEstimate || 'unavailable',
            },
            state: {
                overdueTasks: overdueTaskCount,
                activeTasks: taskCount + checklistItems.length,
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
            activeSignal,
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
            sources: Array.from(sourceById.values()),
        };

        const summary = JSON.stringify(structuredContext, null, 2);

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
            todaySchedule: [],
            metrics: { focusTimeToday: 0, productivityScore: 0, fatigueEstimate: 'unavailable' },
            state: { overdueTasks: 0, activeTasks: 0, activeRoutines: 0, activeProjects: 0 },
            preferences: { language: 'en', theme: 'system', compactMode: false },
            activeSignal: null,
            twinContext: null,
            currentPlan: null,
            recentOutcomes: [],
            providerHealth: [],
            mailbox: null,
            externalSignals: [],
            sources: [NOVO_CONTEXT_SOURCE],
        };

        return {
            summary: JSON.stringify(fallback, null, 2),
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
