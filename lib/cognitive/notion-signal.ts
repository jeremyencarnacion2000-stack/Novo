// Notion signal: three behavioral thresholds computed from already-synced
// ChecklistItem rows (source: 'notion') — see app/api/integration/notion/
// route.ts for how those rows get there. No new API calls, no new auth;
// this only reads what the existing manual sync already wrote. Mirrors
// lib/cognitive/calendar-signal.ts's shape so the cognitive-engine route
// and PlatformConnector layer treat every platform's signals uniformly.

import type { PlatformSignal } from '@/lib/platform-connectors/types';

export interface NotionChecklistItemLite {
  id: string;
  completed: boolean;
  priority: string;
  dueDate: Date | null;
  updatedAt: Date;
}

const STAGNATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DUE_SOON_WINDOW_MS = 2 * 60 * 60 * 1000;

export function evaluateNotionThresholds(
  items: NotionChecklistItemLite[],
  now: Date
): PlatformSignal[] {
  const results: PlatformSignal[] = [];
  if (items.length === 0) return results;

  // Overdue accumulation: 3+ incomplete items with dueDate in the past.
  const overdue = items.filter(
    i => !i.completed && i.dueDate !== null && i.dueDate.getTime() < now.getTime()
  );
  if (overdue.length >= 3) {
    results.push({
      type: 'notion_overdue_accumulation',
      headline: `${overdue.length} tareas de Notion vencidas`,
      detail: 'Se sincronizaron pero nadie les ha hecho caso todavía — vale la pena revisarlas.',
      severity: 'warning',
    });
  }

  // Stagnation: 3+ items touched in the last 7 days, zero completions among them.
  const windowStart = now.getTime() - STAGNATION_WINDOW_MS;
  const recentItems = items.filter(i => i.updatedAt.getTime() >= windowStart);
  const recentCompletions = recentItems.filter(i => i.completed);
  if (recentItems.length >= 3 && recentCompletions.length === 0) {
    results.push({
      type: 'notion_stagnation',
      headline: `${recentItems.length} tareas de Notion activas esta semana, ninguna completada`,
      detail: 'Se están acumulando sin avanzar — vale la pena revisar cuáles siguen siendo relevantes.',
      severity: 'warning',
    });
  }

  // High-priority due soon: incomplete, priority high, due within the next 2 hours.
  const soonThreshold = now.getTime() + DUE_SOON_WINDOW_MS;
  const urgentHighPriority = items.find(
    i => !i.completed &&
      i.priority === 'high' &&
      i.dueDate !== null &&
      i.dueDate.getTime() > now.getTime() &&
      i.dueDate.getTime() <= soonThreshold
  );
  if (urgentHighPriority) {
    results.push({
      type: 'notion_priority_due_soon',
      headline: 'Una tarea de alta prioridad en Notion vence en menos de 2 horas',
      detail: 'Puede valer la pena atenderla antes que las demás.',
      severity: 'warning',
    });
  }

  return results;
}
