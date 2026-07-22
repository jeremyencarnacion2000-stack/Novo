// Todoist signal: same three behavioral thresholds as Notion's, computed
// from already-synced ChecklistItem rows (source: 'todoist') — see
// app/api/integration/todoist/route.ts for how those rows get there.
// Mirrors lib/cognitive/notion-signal.ts's shape/thresholds exactly so the
// cognitive-engine route and PlatformConnector layer treat every platform's
// signals uniformly.

import type { PlatformSignal } from '@/lib/platform-connectors/types';

export interface TodoistChecklistItemLite {
  id: string;
  completed: boolean;
  priority: string;
  dueDate: Date | null;
  updatedAt: Date;
}

const STAGNATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DUE_SOON_WINDOW_MS = 2 * 60 * 60 * 1000;

export function evaluateTodoistThresholds(
  items: TodoistChecklistItemLite[],
  now: Date
): PlatformSignal[] {
  const results: PlatformSignal[] = [];
  if (items.length === 0) return results;

  const overdue = items.filter(
    i => !i.completed && i.dueDate !== null && i.dueDate.getTime() < now.getTime()
  );
  if (overdue.length >= 3) {
    results.push({
      type: 'todoist_overdue_accumulation',
      headline: `${overdue.length} tareas de Todoist vencidas`,
      detail: 'Se sincronizaron pero nadie les ha hecho caso todavía — vale la pena revisarlas.',
      severity: 'warning',
    });
  }

  const windowStart = now.getTime() - STAGNATION_WINDOW_MS;
  const recentItems = items.filter(i => i.updatedAt.getTime() >= windowStart);
  const recentCompletions = recentItems.filter(i => i.completed);
  if (recentItems.length >= 3 && recentCompletions.length === 0) {
    results.push({
      type: 'todoist_stagnation',
      headline: `${recentItems.length} tareas de Todoist activas esta semana, ninguna completada`,
      detail: 'Se están acumulando sin avanzar — vale la pena revisar cuáles siguen siendo relevantes.',
      severity: 'warning',
    });
  }

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
      type: 'todoist_priority_due_soon',
      headline: 'Una tarea de alta prioridad en Todoist vence en menos de 2 horas',
      detail: 'Puede valer la pena atenderla antes que las demás.',
      severity: 'warning',
    });
  }

  return results;
}
