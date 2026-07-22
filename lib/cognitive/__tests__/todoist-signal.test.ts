/// <reference types="jest" />
import { evaluateTodoistThresholds, type TodoistChecklistItemLite } from '../todoist-signal';

describe('evaluateTodoistThresholds', () => {
  const now = new Date('2026-07-14T12:00:00');

  function item(overrides: Partial<TodoistChecklistItemLite>): TodoistChecklistItemLite {
    return {
      id: 'item-1',
      completed: false,
      priority: 'medium',
      dueDate: null,
      updatedAt: now,
      ...overrides,
    };
  }

  it('returns no signals for an empty list', () => {
    expect(evaluateTodoistThresholds([], now)).toEqual([]);
  });

  it('flags overdue accumulation at 3 or more incomplete overdue items', () => {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const items = [
      item({ id: '1', dueDate: yesterday }),
      item({ id: '2', dueDate: yesterday }),
      item({ id: '3', dueDate: yesterday }),
    ];
    const result = evaluateTodoistThresholds(items, now);
    const signal = result.find(s => s.type === 'todoist_overdue_accumulation');
    expect(signal).toBeDefined();
    expect(signal?.headline).toContain('3');
  });

  it('does not flag overdue accumulation with only 2 overdue items', () => {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const items = [
      item({ id: '1', dueDate: yesterday }),
      item({ id: '2', dueDate: yesterday }),
    ];
    const result = evaluateTodoistThresholds(items, now);
    expect(result.find(s => s.type === 'todoist_overdue_accumulation')).toBeUndefined();
  });

  it('flags stagnation when 3+ items touched in the last 7 days have zero completions', () => {
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const items = [
      item({ id: '1', updatedAt: twoDaysAgo }),
      item({ id: '2', updatedAt: twoDaysAgo }),
      item({ id: '3', updatedAt: twoDaysAgo }),
    ];
    const result = evaluateTodoistThresholds(items, now);
    expect(result.find(s => s.type === 'todoist_stagnation')).toBeDefined();
  });

  it('flags a high-priority item due within the next 2 hours', () => {
    const soon = new Date(now.getTime() + 60 * 60 * 1000);
    const items = [item({ id: '1', priority: 'high', dueDate: soon })];
    const result = evaluateTodoistThresholds(items, now);
    expect(result.find(s => s.type === 'todoist_priority_due_soon')).toBeDefined();
  });

  it('does not flag a high-priority item due more than 2 hours out', () => {
    const later = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    const items = [item({ id: '1', priority: 'high', dueDate: later })];
    const result = evaluateTodoistThresholds(items, now);
    expect(result.find(s => s.type === 'todoist_priority_due_soon')).toBeUndefined();
  });
});
