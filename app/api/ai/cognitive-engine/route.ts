import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { groqAPI } from '@/lib/groq';
import { logAICall } from '@/lib/ai-call-log';
import { calendarService, getGoogleAccessToken } from '@/lib/google';
import { fetchBiometricPayload } from '@/lib/google-fit';
import { fetchDbBiometricPayload } from '@/lib/db-biometrics';
import type { BiometricPayload } from '@/types/biometrics';

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// ─── Circadian energy model (science-backed curve) ────────────────────────────
// Peak: 9-11am | Dip: 1-3pm | Recovery: 4-6pm | Decline: 7pm+ (adjusted by chronotype)
function getCircadianEnergyAt(hour: number, chronotype: string = 'intermediate'): number {
  const offsetMap: Record<string, number> = {
    morning_lark: -2,
    intermediate: 0,
    night_owl: 3,
  };
  const offset = offsetMap[chronotype] ?? 0;
  const shifted = (hour - offset + 24) % 24;

  const curve: Record<number, number> = {
    0: 15, 1: 10, 2: 8, 3: 8, 4: 12, 5: 20, 6: 35,
    7: 55, 8: 72, 9: 88, 10: 95, 11: 90, 12: 75,
    13: 60, 14: 45, 15: 50, 16: 65, 17: 70, 18: 62,
    19: 52, 20: 40, 21: 30, 22: 22, 23: 18,
  };
  return curve[shifted] ?? 50;
}

// ─── Cognitive load weight by priority ────────────────────────────────────────
function getCognitiveWeight(priority: string): number {
  return priority === 'high' ? 3 : priority === 'medium' ? 2 : 1;
}

// ─── Calendar signal: meeting density + biggest free block within waking hours ─
// Real commitments outside Novo (synced from the user's own Google Calendar)
// are a direct cognitive-load signal the engine was previously blind to.
interface CalendarSignal {
  connected: boolean;
  meetingCount: number;
  meetingMinutesToday: number;
  largestFreeGapMinutes: number | null;
}

const WAKING_HOURS_START = 7;
const WAKING_HOURS_END = 22;

function computeCalendarSignal(
  events: { start?: { dateTime?: string | null } | null; end?: { dateTime?: string | null } | null }[],
  now: Date
): CalendarSignal {
  const dayStart = new Date(now); dayStart.setHours(WAKING_HOURS_START, 0, 0, 0);
  const dayEnd = new Date(now); dayEnd.setHours(WAKING_HOURS_END, 0, 0, 0);

  // Only timed events count as "busy" — all-day events (date-only, no dateTime) don't block focus time.
  const busy = events
    .filter(e => e.start?.dateTime && e.end?.dateTime)
    .map(e => ({ start: new Date(e.start!.dateTime!), end: new Date(e.end!.dateTime!) }))
    .filter(e => e.end > dayStart && e.start < dayEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const meetingMinutesToday = Math.round(
    busy.reduce((acc, e) =>
      acc + (Math.min(e.end.getTime(), dayEnd.getTime()) - Math.max(e.start.getTime(), dayStart.getTime())), 0
    ) / 60000
  );

  let cursor = dayStart.getTime();
  let largestGapMs = 0;
  for (const e of busy) {
    const s = Math.max(e.start.getTime(), dayStart.getTime());
    if (s > cursor) largestGapMs = Math.max(largestGapMs, s - cursor);
    cursor = Math.max(cursor, Math.min(e.end.getTime(), dayEnd.getTime()));
  }
  if (dayEnd.getTime() > cursor) largestGapMs = Math.max(largestGapMs, dayEnd.getTime() - cursor);

  return {
    connected: true,
    meetingCount: busy.length,
    meetingMinutesToday,
    largestFreeGapMinutes: Math.round(largestGapMs / 60000),
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const chronotypeOverride = searchParams.get('chronotype');

    const userId = session.user.id;
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];

    // Fetched first (not in the Promise.all below) so a cache hit can skip
    // the other 4 queries AND the LLM round-trip entirely — the dashboard
    // widget was re-running a full Gemini/Groq generation on every visit.
    const twinRecord = await prisma.cognitiveTwinRecord.findUnique({ where: { userId } });

    const CACHE_TTL_MS = 10 * 60 * 1000; // signals don't meaningfully shift faster than this
    const cached = (twinRecord?.metrics as any)?.cognitiveEngineCache;
    if (
      cached &&
      !chronotypeOverride &&
      Date.now() - new Date(cached.generatedAt).getTime() < CACHE_TTL_MS
    ) {
      return NextResponse.json({
        success: true,
        report: cached.report,
        signals: cached.signals,
        generatedAt: cached.generatedAt,
        modelUsed: cached.modelUsed ?? null,
        twin: cached.twin ?? (twinRecord ? { confidenceScore: twinRecord.confidenceScore, trustLevel: twinRecord.trustLevel } : null),
      });
    }

    // ── Collect remaining signals in parallel ────────────────────────────────
    const [dbTasks, focusSessions, dailyAnalytics, recentSessions, notionItems] = await Promise.all([
      prisma.task.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
      prisma.focusSession.findMany({
        where: { userId, startTime: { gte: sevenDaysAgo } },
        orderBy: { startTime: 'desc' },
        take: 50,
      }),
      prisma.dailyAnalytics.findMany({
        where: { userId, date: { gte: sevenDaysAgo } },
        orderBy: { date: 'desc' },
        take: 7,
      }),
      prisma.userSession.findMany({
        where: { userId, startTime: { gte: sevenDaysAgo } },
        orderBy: { startTime: 'desc' },
        take: 20,
      }),
      // Notion tasks already sync into ChecklistItem (see IntegrationEngine.
      // getTodayTasks) — the cognitive engine just never read them. Normalize
      // to the Task shape so every downstream calculation picks them up for
      // free instead of duplicating the load/overdue/completion logic.
      prisma.checklistItem.findMany({ where: { userId, source: 'notion' } }),
    ]);

    const tasks = [
      ...dbTasks,
      ...notionItems.map(c => ({
        id: c.id,
        title: c.text,
        priority: c.priority,
        status: c.completed ? 'done' : 'todo',
        dueDate: c.dueDate ? c.dueDate.toISOString().split('T')[0] : null,
        createdAt: c.updatedAt,
        updatedAt: c.updatedAt,
      })),
    ];

    // Google Calendar is optional — most of this app's users sign in with
    // credentials, not "Sign in with Google", so no access token exists.
    // Same graceful-degrade pattern as app/api/calendar/google/route.ts.
    let calendarSignal: CalendarSignal = {
      connected: false, meetingCount: 0, meetingMinutesToday: 0, largestFreeGapMinutes: null,
    };
    try {
      const dayEndIso = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const events = await calendarService.listEvents(todayStart.toISOString(), 50, dayEndIso);
      calendarSignal = computeCalendarSignal(events as any, now);
    } catch {
      // Not connected, or the Google API call failed — no calendar signal this run.
    }

    // Real sleep/stress signal — Google Fit when connected, otherwise the
    // existing DB-driven estimate (app/api/cognitive/biometrics already does
    // this same tiered lookup for its own widget; reused here rather than
    // re-implemented).
    let biometrics: BiometricPayload | null = null;
    try {
      const fitAccessToken = await getGoogleAccessToken(userId, (session as any)?.accessToken);
      biometrics = fitAccessToken
        ? await fetchBiometricPayload(fitAccessToken, userId)
        : await fetchDbBiometricPayload(userId);
    } catch {
      // Leave biometrics null — recoveryState falls back to the session-time heuristic below.
    }

    // ── Compute signals ──────────────────────────────────────────────────────
    const todayTasks = tasks.filter(t => t.dueDate === todayStr);
    const overdueTasks = tasks.filter(t => {
      if (!t.dueDate || t.status === 'done') return false;
      return t.dueDate < todayStr;
    });
    const completedTasks = tasks.filter(t => t.status === 'done');
    const pendingTasks = tasks.filter(t => t.status !== 'done');
    const highPriorityPending = pendingTasks.filter(t => t.priority === 'high');

    // No completed/pending tasks and no focus sessions ever recorded — there is
    // no real behavioral history yet. The insights below must not phrase
    // circadian-math defaults as "detected" patterns when nothing has been
    // observed; time-of-day heuristics (recoveryState, currentEnergy) are still
    // honest to show since they're computed live, not claimed as learned.
    const isColdStart = tasks.length === 0 && focusSessions.length === 0;

    // Task completion rate (last 7 days)
    const recentCompleted = completedTasks.filter(t =>
      new Date(t.updatedAt) >= sevenDaysAgo
    ).length;
    const completionRate = tasks.length > 0 ? Math.round((recentCompleted / tasks.length) * 100) : 50;

    // Focus session quality today
    const todayFocusSessions = focusSessions.filter(s =>
      s.startTime >= todayStart
    );
    const totalFocusMinutesToday = todayFocusSessions.reduce((acc, s) =>
      acc + (s.actualDuration ?? s.duration), 0
    );
    const avgFocusQuality = todayFocusSessions.length > 0
      ? todayFocusSessions.reduce((acc, s) => acc + (s.focusQuality ?? 3), 0) / todayFocusSessions.length
      : 3;
    const interruptions = todayFocusSessions.reduce((acc, s) => acc + s.interruptions, 0);

    // Estimated Recovery State (inferred from earliest session today)
    const earliestSessionToday = recentSessions.find(s =>
      s.startTime >= todayStart
    );
    const sessionStartHour = earliestSessionToday
      ? new Date(earliestSessionToday.startTime).getHours()
      : now.getHours();

    type RecoveryState = 'optimal' | 'moderate' | 'impaired' | 'critical';
    const RECOVERY_SEVERITY: Record<RecoveryState, number> = { optimal: 0, moderate: 1, impaired: 2, critical: 3 };

    let recoveryState: RecoveryState;
    if (sessionStartHour <= 4) recoveryState = 'critical';      // Active before 4am
    else if (sessionStartHour <= 6) recoveryState = 'impaired'; // Active before 6am
    else if (totalFocusMinutesToday > 240) recoveryState = 'moderate'; // >4h focus today
    else recoveryState = 'optimal';

    // Real sleep/stress overrides the time-of-day heuristic above whenever it
    // indicates something WORSE — either signal pointing at trouble should be
    // believed, not averaged away.
    if (biometrics) {
      let biometricRecovery: RecoveryState = 'optimal';
      if (biometrics.userStressScore >= 80 || biometrics.sleep.totalSleepMinutes < 300) biometricRecovery = 'critical';
      else if (biometrics.userStressScore >= 65 || biometrics.sleep.totalSleepMinutes < 360) biometricRecovery = 'impaired';
      else if (biometrics.userStressScore >= 50 || biometrics.sleep.totalSleepMinutes < 420) biometricRecovery = 'moderate';

      if (RECOVERY_SEVERITY[biometricRecovery] > RECOVERY_SEVERITY[recoveryState]) {
        recoveryState = biometricRecovery;
      }
    }

    // Procrastination signal
    const procrastinationScore = Math.min(100,
      (overdueTasks.length * 15) +
      (completionRate < 30 ? 30 : 0) +
      (highPriorityPending.length > 3 ? 20 : 0)
    );

    // Cognitive load
    const cognitiveLoadRaw = todayTasks.reduce((acc, t) =>
      acc + getCognitiveWeight(t.priority), 0
    ) + highPriorityPending.slice(0, 5).reduce((acc, t) =>
      acc + getCognitiveWeight(t.priority), 0
    );
    let cognitiveLoad = Math.min(100, Math.round(cognitiveLoadRaw * 8));

    // Resolve user's chronotype from override or DB record
    const userChronotype = chronotypeOverride || (twinRecord?.energyCurve as any)?.chronotype || 'intermediate';

    // Circadian energy at current hour (adjusted for chronotype)
    const currentHour = now.getHours();
    let currentEnergy = getCircadianEnergyAt(currentHour, userChronotype);

    // Calculate peaks dynamically based on chronotype
    let peakHour = 10;
    let dipHour = 14;
    let peakLabel = '10am';
    let dipLabel = '2pm';
    let peakInstructions = '9-11am';

    if (userChronotype === 'morning_lark') {
      peakHour = 8;
      dipHour = 12;
      peakLabel = '8am';
      dipLabel = '12pm';
      peakInstructions = '7-9am';
    } else if (userChronotype === 'night_owl') {
      peakHour = 13;
      dipHour = 17;
      peakLabel = '1pm';
      dipLabel = '5pm';
      peakInstructions = '12-2pm';
    }

    // Historical patterns from daily analytics
    const avgProductivity = dailyAnalytics.length > 0
      ? dailyAnalytics.reduce((acc, d) => acc + d.productivityScore, 0) / dailyAnalytics.length
      : 50;

    // Focus fragmentation (many short interrupted sessions = fragmented)
    const fragmentedSessions = todayFocusSessions.filter(s => s.interrupted).length;
    const focusFragmentation = todayFocusSessions.length > 0
      ? Math.round((fragmentedSessions / todayFocusSessions.length) * 100)
      : 0;

    // Workload density (tasks per day over last week + real calendar commitments)
    const workloadDensity = Math.min(100,
      overdueTasks.length * 10 + todayTasks.length * 5 + Math.round(calendarSignal.meetingMinutesToday / 20)
    );

    // Burnout risk composite
    let burnoutRisk = Math.min(100, Math.round(
      (workloadDensity * 0.3) +
      (procrastinationScore * 0.25) +
      (focusFragmentation * 0.2) +
      (cognitiveLoad * 0.15) +
      (recoveryState === 'critical' ? 10 : recoveryState === 'impaired' ? 7 : recoveryState === 'moderate' ? 3 : 0)
    ));

    // Focus score (composite of all positive signals)
    const recoveryBonus = recoveryState === 'optimal' ? 20 : recoveryState === 'moderate' ? 10 : 0;
    let focusScore = Math.max(5, Math.min(100, Math.round(
      currentEnergy * 0.35 +
      (100 - cognitiveLoad) * 0.25 +
      (100 - procrastinationScore) * 0.2 +
      (avgFocusQuality / 5 * 100) * 0.1 +
      recoveryBonus * 0.1
    )));

    // Build the 24-hour energy timeline
    const energyTimeline = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${h.toString().padStart(2, '0')}:00`,
      energy: getCircadianEnergyAt(h, userChronotype),
      isCurrent: h === currentHour,
      isPeak: h === peakHour,
      isDip: h === dipHour,
    }));

    // Tasks formatted for Gemini (top 15 pending, ordered for reorganization).
    // No fabricated demo tasks when the user has none — the engine used to
    // invent 7 fake "hackathon pitch deck"-style tasks and hand them to the
    // LLM as if real, so a brand-new user with an empty list got scheduling
    // advice for work they never created. An empty list is a real, valid
    // state the prompt/fallback below both handle honestly instead.
    const displayTasks = pendingTasks;

    const taskContext = displayTasks.slice(0, 15).map(t => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate,
      cognitiveWeight: getCognitiveWeight(t.priority),
    }));

    let twinProfileContext = '';
    if (twinRecord) {
      const identity = (twinRecord.identity as any) || {};
      const bottlenecks = (twinRecord.bottlenecks as any) || {};
      const metrics = (twinRecord.metrics as any) || {};
      twinProfileContext = `
## Learned Cognitive Twin Profile (Database Record)
- User Role/Identity: ${identity.role || 'not_specified'} (industry: ${identity.industry || 'not_specified'})
- User Focus Style: ${identity.focusStyle || 'not_specified'}
- Chronotype (learned): ${userChronotype}
- Main Friction Point: ${bottlenecks.mainFrictionPoint || 'not_detected'}
- Current Cognitive Load (learned): ${metrics.currentCognitiveLoad ?? 30}%
- Burnout Index (learned): ${metrics.burnoutIndex ?? 10}%
- Trust Level: ${twinRecord.trustLevel} (confidence: ${twinRecord.confidenceScore}%)
`;
    }

    // ── Build Gemini prompt ──────────────────────────────────────────────────
    const prompt = `You are NOVO's Adaptive Cognitive Engine — an elite performance intelligence system.

Analyze this user's real-time cognitive state and return a precise JSON report.
${twinProfileContext}

## Current State
- Local time: ${now.toLocaleTimeString()} (Hour: ${currentHour})
- Circadian energy right now: ${currentEnergy}% (peak at ${peakLabel}, dip at ${dipLabel})
- Estimated Recovery State: ${recoveryState}
- Focus Score computed: ${focusScore}/100

## Task Load
- Total tasks pending: ${pendingTasks.length}${notionItems.length > 0 ? ` (${notionItems.length} synced from Notion)` : ''}
- High priority pending: ${highPriorityPending.length}
- Today's tasks: ${todayTasks.length}
- Overdue tasks: ${overdueTasks.length}
- 7-day completion rate: ${completionRate}%

## Calendar (real commitments outside Novo)
${calendarSignal.connected
  ? `- Meetings today: ${calendarSignal.meetingCount} (${calendarSignal.meetingMinutesToday} minutes total)
- Largest free block today (${WAKING_HOURS_START}:00-${WAKING_HOURS_END}:00): ${calendarSignal.largestFreeGapMinutes} minutes — do NOT schedule reorganizedDay tasks outside this window if it's small`
  : '- Not connected — schedule purely off task/energy signals'}

## Biometrics (${biometrics?.meta.sleepDataSource === 'google_fit' ? 'Google Fit' : 'estimated from activity data'})
${biometrics
  ? `- Sleep last night: ${biometrics.sleep.totalSleepMinutes} minutes (efficiency ${biometrics.sleep.sleepEfficiency}%)
- Resting heart rate: ${biometrics.heartRate.hasData ? `${biometrics.heartRate.averageBpm} bpm avg` : 'no data'}
- Stress score: ${biometrics.userStressScore}/100 (${biometrics.stressLevel})`
  : '- Unavailable this run'}

## Cognitive Signals
- Cognitive Load: ${cognitiveLoad}/100
- Procrastination Index: ${procrastinationScore}/100
- Burnout Risk: ${burnoutRisk}/100
- Focus Fragmentation: ${focusFragmentation}%
- Focus sessions today: ${todayFocusSessions.length} (${totalFocusMinutesToday} minutes total)
- Interruptions today: ${interruptions}
- Avg 7-day productivity score: ${Math.round(avgProductivity)}

## Pending Tasks (for day reorganization)
${taskContext.length > 0 ? JSON.stringify(taskContext, null, 2) : 'None — the user has no pending tasks right now. Leave reorganizedDay empty and base the recommendation on their energy/recovery state instead of inventing tasks.'}

## Instructions
Return ONLY valid JSON (no markdown, no explanation outside JSON):

{
  "focusScore": number 0-100,
  "energyLevel": "high" | "medium" | "low" | "critical",
  "recoveryState": "${recoveryState}",
  "procrastinationAlert": boolean,
  "cognitiveLoad": number 0-100,
  "burnoutRisk": number 0-100,
  "focusFragmentation": number 0-100,
  "peakWindowStart": number (hour 0-23),
  "peakWindowEnd": number (hour 0-23),
  "reorganizedDay": [
    {
      "id": "task id",
      "title": "task title",
      "priority": "high|medium|low",
      "scheduledHour": number (0-23),
      "scheduledTime": "HH:MM",
      "reason": "One sentence explaining WHY this task is scheduled at this time based on cognitive science"
    }
  ],
  "insights": [
    {
      "type": "recovery" | "procrastination" | "cognitive_load" | "focus_window" | "pattern",
      "severity": "info" | "warning" | "critical",
      "headline": "Short 5-7 word insight title",
      "detail": "One concrete sentence with specific numbers"
    }
  ],
  "recommendation": "One powerful, specific action the user should take RIGHT NOW based on their cognitive state",
  "cognitiveMemory": "One sentence about a historical pattern detected from the data (e.g. task abandonment pattern, peak hour pattern)"
}

Rules:
- Reorganize tasks based on cognitive weight matching energy level (heavy tasks at peak, light tasks at dip)
- Schedule max 3 high-priority tasks in peak window (${peakInstructions})
- Keep reorganizedDay to top 8 tasks max
- Make insights feel like they came from a real cognitive scientist, not generic advice
- The "reason" for each task must reference specific data (e.g., "Scheduled at ${peakLabel} because your circadian peak is 95% capacity")
- Be specific with numbers in detail fields`;

    let text = '';
    let successModel = '';

    // 1. Try Gemini
    if (process.env.GEMINI_API_KEY && genAI) {
      try {
        console.log('[Cognitive API] Attempting Gemini query...');
        const result = await logAICall(
          { userId: session.user.id, provider: 'gemini', model: 'gemini-1.5-flash', purpose: 'cognitive_reorg' },
          async () => {
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const geminiResult = await model.generateContent(prompt);
            return {
              content: geminiResult.response.text().trim(),
              tokensIn: geminiResult.response.usageMetadata?.promptTokenCount,
              tokensOut: geminiResult.response.usageMetadata?.candidatesTokenCount,
            };
          }
        );
        text = result.content;
        successModel = 'gemini';
      } catch (geminiError) {
        console.error('[Cognitive API] Gemini request failed:', geminiError);
      }
    }

    // 2. Try Groq (Primary Fallback)
    if (!text && process.env.GROQ_API_KEY) {
      try {
        console.log('[Cognitive API] Falling back to Groq...');
        const result = await logAICall(
          { userId: session.user.id, provider: 'groq', model: 'qwen/qwen3-32b', purpose: 'cognitive_reorg' },
          () => groqAPI.generateResponse(
            prompt,
            '',
            [],
            'You are NOVO\'s Adaptive Cognitive Engine — an elite performance intelligence system.',
            'qwen/qwen3-32b'
          )
        );
        text = result.content.trim();
        successModel = 'groq';
      } catch (groqError) {
        console.error('[Cognitive API] Groq request failed:', groqError);
      }
    }

    // 3. Parse Response or fallback to Premium Local Cognitive Synthesis
    let cognitiveReport;
    if (text) {
      try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        cognitiveReport = JSON.parse(cleaned);
        console.log(`[Cognitive API] Successfully parsed report generated by ${successModel}`);
      } catch (parseError) {
        console.error('[Cognitive API] Failed to parse generated JSON content:', parseError);
      }
    }

    if (!cognitiveReport) {
      console.log('[Cognitive API] All remote models unavailable or failed. Initiating high-fidelity Local Cognitive Synthesis...');
      
      const insights = [
        {
          type: 'recovery',
          severity: isColdStart ? 'info' : recoveryState === 'critical' ? 'critical' : recoveryState === 'impaired' ? 'warning' : 'info',
          headline: isColdStart
            ? 'Aún sin historial real'
            : recoveryState === 'critical' ? 'Impaired Sleep Debt Detected' : 'Optimal Recovery Cycle',
          detail: isColdStart
            ? `Todavía no tienes tareas ni sesiones registradas — el Twin aún no puede detectar patrones. Por ahora, según la hora actual, tu ventana de energía estimada está en ${currentEnergy}% de capacidad.`
            : recoveryState === 'critical'
              ? 'Activity patterns before 4:00 AM indicate high sleep debt. Prioritize cognitive restoration and low-friction tasks.'
              : 'Estimated recovery state is optimal. Your neural networks show high receptivity for deep focused work.'
        },
        {
          type: 'cognitive_load',
          severity: cognitiveLoad > 70 ? 'critical' : cognitiveLoad > 45 ? 'warning' : 'info',
          headline: cognitiveLoad > 70 ? 'High Working Memory Load' : 'Sustained Mental Capacity',
          detail: `Your cognitive load is at ${cognitiveLoad}% with ${pendingTasks.length} pending tasks currently generating cognitive weight.`
        },
        {
          type: 'procrastination',
          severity: isColdStart ? 'info' : procrastinationScore > 50 ? 'warning' : 'info',
          headline: isColdStart ? 'Sin datos de procrastinación aún' : procrastinationScore > 50 ? 'Task Rescheduling Habit Detected' : 'High Focus Momentum',
          detail: isColdStart
            ? 'Agrega y completa tareas para que el Twin empiece a medir tu ritmo real de ejecución.'
            : `Procrastination index stands at ${procrastinationScore}%. A 7-day completion rate of ${completionRate}% supports task focus.`
        },
        {
          type: 'focus_window',
          severity: 'info',
          headline: 'Circadian Peak Window Active',
          detail: `Your circadian energy curve indicates peak cognitive endurance between ${
            userChronotype === 'morning_lark' ? '7:00 AM and 9:30 AM' :
            userChronotype === 'night_owl' ? '12:00 PM and 2:30 PM' :
            '9:00 AM and 11:30 AM'
          } (currently at ${currentEnergy}% capacity).`
        }
      ];

      // Smart scientific task scheduling (shifted based on chronotype)
      const offsetMap: Record<string, number> = {
        morning_lark: -2,
        intermediate: 0,
        night_owl: 3,
      };
      const offset = offsetMap[userChronotype] ?? 0;
      const baseScheduleHours = [9, 10, 11, 13, 14, 15, 16, 17];
      const scheduleHours = baseScheduleHours.map(h => (h + offset + 24) % 24);

      const scheduledTasks = displayTasks.slice(0, 8).map((t, index) => {
        const hour = scheduleHours[index] || ((9 + index + offset + 24) % 24);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const timeLabel = `${displayHour.toString().padStart(2, '0')}:00 ${ampm}`;
        
        let reason = '';
        if (t.priority === 'high') {
          reason = `Scheduled at ${timeLabel} to leverage your circadian peak (${currentEnergy}% capacity) for intensive problem-solving.`;
        } else if (t.priority === 'medium') {
          reason = `Assigned to ${timeLabel} during a stable focus plateau to protect primary working memory reserves.`;
        } else {
          reason = `Positioned at ${timeLabel} to utilize lower-demand hours, matching lower active cognitive overhead.`;
        }

        return {
          id: t.id,
          title: t.title,
          priority: t.priority,
          scheduledHour: hour,
          scheduledTime: `${hour.toString().padStart(2, '0')}:00`,
          reason
        };
      });

      const localPeakStart = userChronotype === 'morning_lark' ? 7 : userChronotype === 'night_owl' ? 12 : 9;
      const localPeakEnd = userChronotype === 'morning_lark' ? 9 : userChronotype === 'night_owl' ? 14 : 11;

      cognitiveReport = {
        focusScore,
        energyLevel: currentEnergy > 70 ? 'high' : currentEnergy > 40 ? 'medium' : 'low',
        recoveryState,
        procrastinationAlert: procrastinationScore > 40,
        cognitiveLoad,
        burnoutRisk,
        focusFragmentation,
        peakWindowStart: localPeakStart,
        peakWindowEnd: localPeakEnd,
        reorganizedDay: scheduledTasks,
        insights,
        recommendation: burnoutRisk > 60
          ? 'Workload density triggers high burnout warnings. Initiate a 15-minute screen-free rest window immediately.'
          : displayTasks.length > 0
            ? `Align your highest effort task: "${displayTasks[0].title}" with your circadian peak window today.`
            : 'No pending tasks right now — a good moment to plan your next priority before it becomes urgent.',
        // Real numbers, not a fixed narrative: this used to be a hardcoded
        // sentence ("completion momentum stays high until overdue task
        // counts cross 5 units") that never changed regardless of the
        // user's actual data.
        cognitiveMemory: `Your 7-day completion rate is ${completionRate}%${overdueTasks.length > 0 ? `, with ${overdueTasks.length} task${overdueTasks.length === 1 ? '' : 's'} currently overdue` : ', with nothing overdue right now'}.`
      };
      successModel = 'local-fallback';
    }

    const responseSignals = {
      focusScore,
      currentHour,
      currentEnergy,
      energyTimeline,
      cognitiveLoad,
      procrastinationScore,
      burnoutRisk,
      focusFragmentation,
      workloadDensity,
      recoveryState,
      totalFocusMinutesToday,
      overdueTasks: overdueTasks.length,
      pendingTasks: pendingTasks.length,
      completionRate,
      todayTaskCount: todayTasks.length,
      notionTaskCount: notionItems.length,
      calendar: calendarSignal,
      biometrics: biometrics ? {
        sleepMinutes: biometrics.sleep.totalSleepMinutes,
        sleepEfficiency: biometrics.sleep.sleepEfficiency,
        stressScore: biometrics.userStressScore,
        stressLevel: biometrics.stressLevel,
        source: biometrics.meta.sleepDataSource,
      } : null,
    };
    const generatedAt = now.toISOString();
    // Real attribution instead of a static "Powered by Gemini" footer claim,
    // and the twin's actual learning output (process-twin-signal.ts) —
    // previously computed but never sent past the prompt, so the one page
    // named "Cognitive Twin" never showed the twin's own confidence/trust.
    const twin = twinRecord ? { confidenceScore: twinRecord.confidenceScore, trustLevel: twinRecord.trustLevel } : null;

    // Best-effort cache write for the next request within CACHE_TTL_MS — a
    // failure here shouldn't fail a response the user is already waiting on.
    if (twinRecord) {
      prisma.cognitiveTwinRecord.update({
        where: { userId },
        data: {
          metrics: {
            ...((twinRecord.metrics as any) || {}),
            cognitiveEngineCache: { report: cognitiveReport, signals: responseSignals, generatedAt, modelUsed: successModel, twin },
          },
        },
      }).catch((err) => console.error('[Cognitive API] cache write failed:', err));
    }

    // Attach computed timeline and raw signals to response
    return NextResponse.json({
      success: true,
      report: cognitiveReport,
      signals: responseSignals,
      generatedAt,
      modelUsed: successModel,
      twin,
    });

  } catch (error) {
    console.error('[COGNITIVE ENGINE ERROR]', error);
    return NextResponse.json({ error: 'Engine failed to process signals' }, { status: 500 });
  }
}
