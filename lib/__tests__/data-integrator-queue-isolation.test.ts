import { pendingOperationsForUser } from '@/lib/data-integrator'

describe('DataIntegrator offline queue account isolation', () => {
  it('replays only pending mutations owned by the active account', () => {
    const queue = [
      { id: 1, userId: 'account-a', status: 'pending', endpoint: '/api/tasks' },
      { id: 2, userId: 'account-b', status: 'pending', endpoint: '/api/tasks' },
      { id: 3, userId: 'account-a', status: 'conflicted', endpoint: '/api/tasks' },
      { id: 4, status: 'pending', endpoint: '/api/tasks' },
    ]

    expect(pendingOperationsForUser(queue, 'account-a').map(operation => operation.id)).toEqual([1])
    expect(pendingOperationsForUser(queue, 'account-b').map(operation => operation.id)).toEqual([2])
  })
})
