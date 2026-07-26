'use server';

/**
 * Twin Agent — Autonomous proactive actions engine
 *
 * Runs after every Inngest twin-signal step. Reads the current state of the
 * Cognitive Twin (behavioral patterns, metrics, signals) and fires concrete
 * real-world actions when trigger conditions are met. Each capability has
 * a cooldown guard to prevent notification fatigue.
 *
 * Capabilities:
 *   1. create_catchup_task       — procrastination / friction detected
 *   2. triage_overdue_tasks      — ≥3 overdue tasks across Novo + Todoist
 *   3. notify_burnout_risk       — burnout index > 60
 *   4. suggest_focus_block       — peak window opening in 30-60 min
 *   5. reschedule_overload       — cognitive load > 80
 *   6. suggest_recovery_routine  — 3 consecutive days without routine completion
 */

import { prisma } from '@/lib/prisma';
import { google } from 'googleapis';

// ── Types ─────────────────────────────────────────────────────────────────────

type CapabilityId =
  | 'create_catchup_task'
  | 'triage_overdue_tasks'
  | 'notify_burnout_risk'
  | 'suggest_focus_block'
  | 'reschedule_overload'
  | 'suggest_recovery_routine';

interface AgentContext {
  userId: string;
  twinId: string;
  twin: {
    confidenceScore: number;
    trustLevel: string;
    identity: any;
    energyCurve: any;
    metrics: any;
    bottlenecks: any;
  };
  recentSignals: { signal: string; count: number }[];
  recentLogs: { capability: string; createdAt: Date }[];
}

interface CapabilityResult {
  capability: CapabilityId;
  result: 'success' | 'skipped' | 'failed';
  description: string;
  metadata?: Record<string, any>;
}

// Cooldown periods in hours
const COOLDOWNS: Record<CapabilityId, number> = {
  create_catchup_task: 24,
  triage_overdue_tasks: 12,
  notify_burnout_risk: 24,
  suggest_focus_block: 8,
  reschedule_overload: 12,
  suggest_recovery_routine: 48,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function isOnCooldown(ctx: AgentContext, capability: CapabilityId): Promise<boolean> {
  const hours = COOLDOWNS[capability];
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const last = ctx.recentLogs.find(
    (l) => l.capability === capability && l.createdAt > since,
  );
  return !!last;
}

async function logAction(
  ctx: AgentContext,
  capability: CapabilityId,
  result: 'success' | 'skipped' | 'failed',
  description: string,
  metadata?: Record<string, any>,
): Promise<void> {
  try {
    await prisma.twinAgentLog.create({
      data: {
        twinId: ctx.twinId,
        userId: ctx.userId,
        capability,
        trigger: '',
        description,
        result,
        metadata: metadata ?? {},
      },
    });
  } catch (err) {
    console.error('[TwinAgent] Failed to log action:', err);
  }
}

async function postSlackMessage(userId: string, text: string): Promise<boolean> {
  try {
    const account = await prisma.integrationAccount.findUnique({
      where: { userId_provider: { userId, provider: 'slack' } },
      select: { accessToken: true, metadata: true },
    });
    if (!account?.accessToken) return false;

    const meta = account.metadata as any;
    const channel = meta?.defaultChannel || meta?.channelId;
    if (!channel) return false;

    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel, text }),
    });
    const json = await res.json();
    return json.ok === true;
  } catch {
    return false;
  }
}

async function createGoogleCalendarEvent(
  userId: string,
  summary: string,
  startTime: Date,
  endTime: Date,
): Promise<boolean> {
  try {
    const account = await prisma.account.findFirst({
      where: { userId, provider: 'google' },
      select: { access_token: true, refresh_token: true },
    });
    if (!account?.access_token) return false;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token ?? undefined,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        start: { dateTime: startTime.toISOString() },
        end: { dateTime: endTime.toISOString() },
      },
    });
    return true;
  } catch {
    return false;
  }
}

// ── Capabilities ──────────────────────────────────────────────────────────────

/** 1. Procrastination / friction — creates a catchup task */
async function runCreateCatchupTask(ctx: AgentContext): Promise<CapabilityResult> {
  const cap: CapabilityId = 'create_catchup_task';

  const friction = ctx.twin.bottlenecks?.mainFrictionPoint as string | undefined;
  const deferCount = ctx.recentSignals.find((s) => s.signal === 'task_deferred')?.count ?? 0;

  if (!friction && deferCount < 2) {
    return { capability: cap, result: 'skipped', description: 'No friction detected' };
  }
  if (await isOnCooldown(ctx, cap)) {
    return { capability: cap, result: 'skipped', description: 'On cooldown' };
  }

  try {
    const dueDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await prisma.task.create({
      data: {
        userId: ctx.userId,
        title: `🔄 Twin Agent: Retomar "${friction ?? 'tareas diferidas'}"`,
        status: 'todo',
        priority: 'high',
        dueDate: dueDate.toISOString().split('T')[0],
        tags: JSON.stringify(['twin-agent', 'catchup']),
      },
    });

    await postSlackMessage(
      ctx.userId,
      `🧠 *Tu Twin detectó procrastinación.*\n> Bloqueo: _${friction ?? 'múltiples tareas diferidas'}_\nCreé una tarea de recuperación con prioridad alta.`,
    );

    await logAction(ctx, cap, 'success', 'Catchup task created', { friction, deferCount });
    return { capability: cap, result: 'success', description: 'Catchup task created', metadata: { friction, deferCount } };
  } catch (err) {
    await logAction(ctx, cap, 'failed', String(err));
    return { capability: cap, result: 'failed', description: String(err) };
  }
}

/** 2. Triage overdue tasks */
async function runTriageOverdueTasks(ctx: AgentContext): Promise<CapabilityResult> {
  const cap: CapabilityId = 'triage_overdue_tasks';

  if (await isOnCooldown(ctx, cap)) {
    return { capability: cap, result: 'skipped', description: 'On cooldown' };
  }

  try {
    const now = new Date().toISOString().split('T')[0];

    const overdueTasks = await prisma.task.findMany({
      where: {
        userId: ctx.userId,
        status: { in: ['todo', 'in-progress'] },
        dueDate: { lt: now },
      },
      orderBy: { dueDate: 'asc' },
      take: 8,
    });

    const overdueChecklist = await prisma.checklistItem.findMany({
      where: {
        userId: ctx.userId,
        completed: false,
        dueDate: { lt: new Date(now) },
      },
      take: 8,
    });

    const total = overdueTasks.length + overdueChecklist.length;
    if (total < 3) {
      return { capability: cap, result: 'skipped', description: `Only ${total} overdue task(s)` };
    }

    const titles = [
      ...overdueTasks.map((t) => `• ${t.title}`),
      ...overdueChecklist.map((c) => `• ${c.text} (${c.source})`),
    ].slice(0, 8);

    await prisma.task.create({
      data: {
        userId: ctx.userId,
        title: `📋 Twin Agent: Triage de ${total} tareas vencidas`,
        status: 'todo',
        priority: 'high',
        dueDate: new Date().toISOString().split('T')[0],
        tags: JSON.stringify(['twin-agent', 'triage']),
      },
    });

    await postSlackMessage(
      ctx.userId,
      `⚠️ *${total} tareas vencidas detectadas.*\n${titles.join('\n')}\n\nCreé una tarea de triage para revisarlas hoy.`,
    );

    await logAction(ctx, cap, 'success', `Triaged ${total} overdue tasks`, { total });
    return { capability: cap, result: 'success', description: `Triaged ${total} overdue tasks`, metadata: { total } };
  } catch (err) {
    await logAction(ctx, cap, 'failed', String(err));
    return { capability: cap, result: 'failed', description: String(err) };
  }
}

/** 3. Burnout risk notification */
async function runNotifyBurnoutRisk(ctx: AgentContext): Promise<CapabilityResult> {
  const cap: CapabilityId = 'notify_burnout_risk';

  const burnoutIndex = ctx.twin.metrics?.burnoutIndex as number | undefined;
  if (!burnoutIndex || burnoutIndex < 60) {
    return { capability: cap, result: 'skipped', description: `Burnout index ${burnoutIndex ?? 'unknown'} < 60` };
  }
  if (await isOnCooldown(ctx, cap)) {
    return { capability: cap, result: 'skipped', description: 'On cooldown' };
  }

  try {
    await postSlackMessage(
      ctx.userId,
      `🔴 *Riesgo de burnout detectado* (índice: ${burnoutIndex.toFixed(0)})\n` +
        `> Recomendaciones de tu Twin:\n` +
        `• Toma un descanso de 20 min ahora\n` +
        `• Cancela o pospone reuniones no críticas de hoy\n` +
        `• Activa modo "Proteger energía" en tu calendario`,
    );

    await logAction(ctx, cap, 'success', `Burnout alert sent`, { burnoutIndex });
    return { capability: cap, result: 'success', description: 'Burnout alert sent', metadata: { burnoutIndex } };
  } catch (err) {
    await logAction(ctx, cap, 'failed', String(err));
    return { capability: cap, result: 'failed', description: String(err) };
  }
}

/** 4. Suggest focus block when peak window is opening */
async function runSuggestFocusBlock(ctx: AgentContext): Promise<CapabilityResult> {
  const cap: CapabilityId = 'suggest_focus_block';

  const peakStart = ctx.twin.energyCurve?.peakFocusStart as string | undefined;
  if (!peakStart) {
    return { capability: cap, result: 'skipped', description: 'No peak window data' };
  }

  const [h, m] = peakStart.split(':').map(Number);
  const peakStartToday = new Date();
  peakStartToday.setHours(h, m, 0, 0);
  const minutesUntilPeak = (peakStartToday.getTime() - Date.now()) / 60000;

  if (minutesUntilPeak < 0 || minutesUntilPeak > 60) {
    return { capability: cap, result: 'skipped', description: `Peak window not imminent (${minutesUntilPeak.toFixed(0)} min away)` };
  }
  if (await isOnCooldown(ctx, cap)) {
    return { capability: cap, result: 'skipped', description: 'On cooldown' };
  }

  const alreadyFocusing = await prisma.focusSession.findFirst({
    where: {
      userId: ctx.userId,
      startTime: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    },
  });
  if (alreadyFocusing) {
    return { capability: cap, result: 'skipped', description: 'Focus session already active today' };
  }

  try {
    const blockStart = peakStartToday;
    const blockEnd = new Date(blockStart.getTime() + 90 * 60 * 1000);

    const calendarBlocked = await createGoogleCalendarEvent(
      ctx.userId,
      '🧠 Bloque de Enfoque Profundo (Twin Agent)',
      blockStart,
      blockEnd,
    );

    await postSlackMessage(
      ctx.userId,
      `⚡ *Tu ventana pico de concentración comienza en ${minutesUntilPeak.toFixed(0)} min* (${peakStart})\n` +
        `${calendarBlocked ? '✅ Bloqueé 90 min en tu Google Calendar.' : ''}\nEs el mejor momento para tu tarea más importante.`,
    );

    await logAction(ctx, cap, 'success', 'Focus block suggested', { minutesUntilPeak, calendarBlocked });
    return { capability: cap, result: 'success', description: 'Focus block suggested', metadata: { minutesUntilPeak, calendarBlocked } };
  } catch (err) {
    await logAction(ctx, cap, 'failed', String(err));
    return { capability: cap, result: 'failed', description: String(err) };
  }
}

/** 5. Reschedule low-priority tasks when overloaded */
async function runRescheduleOverload(ctx: AgentContext): Promise<CapabilityResult> {
  const cap: CapabilityId = 'reschedule_overload';

  const cogLoad = ctx.twin.metrics?.currentCognitiveLoad as number | undefined;
  if (!cogLoad || cogLoad < 80) {
    return { capability: cap, result: 'skipped', description: `Cognitive load ${cogLoad ?? 'unknown'} < 80` };
  }
  if (await isOnCooldown(ctx, cap)) {
    return { capability: cap, result: 'skipped', description: 'On cooldown' };
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const lowPriorityToday = await prisma.task.findMany({
      where: {
        userId: ctx.userId,
        status: { in: ['todo', 'in-progress'] },
        priority: { in: ['low', 'medium'] },
        dueDate: today,
      },
      take: 5,
    });

    if (lowPriorityToday.length === 0) {
      return { capability: cap, result: 'skipped', description: 'No low-priority tasks to reschedule' };
    }

    await Promise.all(
      lowPriorityToday.map((t) =>
        prisma.task.update({ where: { id: t.id }, data: { dueDate: tomorrow } }),
      ),
    );

    const titles = lowPriorityToday.map((t) => `• ${t.title}`).join('\n');
    await postSlackMessage(
      ctx.userId,
      `🧠 *Carga cognitiva alta (${cogLoad.toFixed(0)}%)* — Tu Twin redistribuyó ${lowPriorityToday.length} tarea(s) de baja prioridad a mañana:\n${titles}`,
    );

    await logAction(ctx, cap, 'success', `Rescheduled ${lowPriorityToday.length} tasks`, { cogLoad, count: lowPriorityToday.length });
    return { capability: cap, result: 'success', description: `Rescheduled ${lowPriorityToday.length} tasks`, metadata: { cogLoad } };
  } catch (err) {
    await logAction(ctx, cap, 'failed', String(err));
    return { capability: cap, result: 'failed', description: String(err) };
  }
}

/** 6. Recovery routine after 3 consecutive days without completing any routine */
async function runSuggestRecoveryRoutine(ctx: AgentContext): Promise<CapabilityResult> {
  const cap: CapabilityId = 'suggest_recovery_routine';

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const skippedCount = ctx.recentSignals.find((s) => s.signal === 'routine_skipped')?.count ?? 0;
  const completedCount = ctx.recentSignals.find((s) => s.signal === 'routine_completed')?.count ?? 0;

  if (skippedCount < 3 || completedCount > 0) {
    return { capability: cap, result: 'skipped', description: `Not enough skipped routines (${skippedCount})` };
  }
  if (await isOnCooldown(ctx, cap)) {
    return { capability: cap, result: 'skipped', description: 'On cooldown' };
  }

  try {
    await prisma.routine.create({
      data: {
        userId: ctx.userId,
        name: '🌱 Rutina de Recuperación (Twin Agent)',
        description: 'Rutina suave para retomar el ritmo tras días sin completar rutinas.',
        timeOfDay: 'morning',
        duration: 15,
        isActive: true,
        scheduledTime: '09:00',
        daysOfWeek: JSON.stringify(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
        version: 1,
      },
    });

    await postSlackMessage(
      ctx.userId,
      `🌱 *Tu Twin detectó ${skippedCount} días sin completar rutinas.*\nCreé una *Rutina de Recuperación de 15 min* (mañanas) para ayudarte a retomar el ritmo.`,
    );

    await logAction(ctx, cap, 'success', 'Recovery routine created', { skippedCount });
    return { capability: cap, result: 'success', description: 'Recovery routine created', metadata: { skippedCount } };
  } catch (err) {
    await logAction(ctx, cap, 'failed', String(err));
    return { capability: cap, result: 'failed', description: String(err) };
  }
}

// ── Main Entry Point ──────────────────────────────────────────────────────────

export async function runTwinAgent(userId: string): Promise<CapabilityResult[]> {
  try {
    const twinRecord = await prisma.cognitiveTwinRecord.findUnique({
      where: { userId },
      select: {
        id: true,
        confidenceScore: true,
        trustLevel: true,
        identity: true,
        energyCurve: true,
        metrics: true,
        bottlenecks: true,
      },
    });

    if (!twinRecord || twinRecord.confidenceScore < 30) {
      return []; // Not enough data to act autonomously
    }

    const [recentSignalGroups, recentAgentLogs] = await Promise.all([
      prisma.behavioralSignal.groupBy({
        by: ['signal'],
        where: {
          userId,
          occurredAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        },
        _count: { signal: true },
      }),
      prisma.twinAgentLog.findMany({
        where: { userId, createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
        select: { capability: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const ctx: AgentContext = {
      userId,
      twinId: twinRecord.id,
      twin: {
        confidenceScore: twinRecord.confidenceScore,
        trustLevel: twinRecord.trustLevel,
        identity: twinRecord.identity,
        energyCurve: twinRecord.energyCurve,
        metrics: twinRecord.metrics,
        bottlenecks: twinRecord.bottlenecks,
      },
      recentSignals: recentSignalGroups.map((g) => ({
        signal: g.signal,
        count: g._count.signal,
      })),
      recentLogs: recentAgentLogs,
    };

    // Run all capabilities in parallel (each guards itself with cooldown checks)
    const results = await Promise.all([
      runCreateCatchupTask(ctx),
      runTriageOverdueTasks(ctx),
      runNotifyBurnoutRisk(ctx),
      runSuggestFocusBlock(ctx),
      runRescheduleOverload(ctx),
      runSuggestRecoveryRoutine(ctx),
    ]);

    const acted = results.filter((r) => r.result === 'success');
    if (acted.length > 0) {
      console.log('[TwinAgent] Actions taken:', acted.map((r) => r.capability).join(', '));
    }

    return results;
  } catch (err) {
    console.error('[TwinAgent] Fatal error:', err);
    return [];
  }
}
