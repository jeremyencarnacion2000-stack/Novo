import { backupImportKey, swapTempId } from '../data-integrator'

describe('backupImportKey', () => {
  it('is stable for the same backup item and scoped to the backup timestamp', () => {
    const item = { id: 'task-1', title: 'Finish consent flow' }
    expect(backupImportKey('task', item, '2026-09-12T10:00:00.000Z', 0))
      .toBe(backupImportKey('task', item, '2026-09-12T10:00:00.000Z', 0))
    expect(backupImportKey('task', item, '2026-09-12T10:00:00.000Z', 0))
      .not.toBe(backupImportKey('task', item, '2026-09-13T10:00:00.000Z', 0))
  })

  it('keeps the server key within the accepted header limit', () => {
    expect(backupImportKey('task', { id: 'x'.repeat(500) }, '2026-09-12T10:00:00.000Z', 0).length)
      .toBeLessThanOrEqual(128)
  })
})

describe('swapTempId', () => {
  it('replaces the id of the matching item, leaving others untouched', () => {
    const items = [
      { id: 'a', title: 'first' },
      { id: 'temp-123', title: 'offline-created' },
      { id: 'b', title: 'third' },
    ]
    const result = swapTempId(items, 'temp-123', 'real-456')
    expect(result).toEqual([
      { id: 'a', title: 'first' },
      { id: 'real-456', title: 'offline-created' },
      { id: 'b', title: 'third' },
    ])
  })

  it('is a no-op when the temp id is not present', () => {
    const items = [{ id: 'a', title: 'first' }]
    expect(swapTempId(items, 'temp-999', 'real-456')).toEqual(items)
  })

  it('handles an empty array', () => {
    expect(swapTempId([], 'temp-123', 'real-456')).toEqual([])
  })

  it('does not mutate the original array', () => {
    const items = [{ id: 'temp-1', title: 'x' }]
    const result = swapTempId(items, 'temp-1', 'real-1')
    expect(result).not.toBe(items)
    expect(items[0].id).toBe('temp-1')
  })
})
