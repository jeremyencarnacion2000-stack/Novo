import { inferTaskPriority } from '../task-priority'

describe('Twin Agent adapts user-owned tasks', () => {
  const now = new Date('2026-08-02T12:00:00.000Z')

  it('elevates a user-created task when its deadline is imminent', () => {
    expect(inferTaskPriority({
      id: 'manual-1', title: 'Preparar demo', status: 'todo', priority: 'low',
      dueDate: '2026-08-02', tags: '[]',
    }, now)).toBe('high')
  })

  it('preserves the signal that an active task deserves attention', () => {
    expect(inferTaskPriority({
      id: 'manual-2', title: 'Revisar calendario', status: 'in-progress', priority: 'medium',
      dueDate: null, tags: '[]',
    }, now)).toBe('medium')
  })

  it('does not demote a user-declared high priority without stronger user input', () => {
    expect(inferTaskPriority({
      id: 'manual-high', title: 'Cerrar el flujo de pago', status: 'todo', priority: 'high',
      dueDate: null, tags: '[]',
    }, now)).toBe('high')
  })

  it('does not treat agent-created labels as a reason to demote a task', () => {
    expect(inferTaskPriority({
      id: 'manual-3', title: 'Tarea del usuario', status: 'todo', priority: 'medium',
      dueDate: null, tags: '["twin-agent"]',
    }, now)).toBe('medium')
  })
})
