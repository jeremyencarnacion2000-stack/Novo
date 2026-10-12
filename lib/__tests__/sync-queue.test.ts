import { clearQueue, createOfflineFetch, enqueue, flushQueue, getQueue } from '@/lib/sync-queue'

describe('offline mutation queue', () => {
  const originalWindowFetch = window.fetch
  const originalOnline = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')

  beforeEach(() => {
    clearQueue()
    jest.restoreAllMocks()
  })

  afterEach(() => {
    window.fetch = originalWindowFetch
    if (originalOnline) Object.defineProperty(Navigator.prototype, 'onLine', originalOnline)
  })

  it('adds one stable idempotency key before the first mutation attempt', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response('{}', { status: 201 }))
    window.fetch = fetchMock as typeof window.fetch

    await createOfflineFetch()('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })

    const requestHeaders = new Headers(fetchMock.mock.calls[0][1].headers)
    expect(requestHeaders.get('Idempotency-Key')).toMatch(/^offline-/)
  })

  it('stores the same key it attempted when a network error is queued', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('offline'))
    window.fetch = fetchMock as typeof window.fetch
    Object.defineProperty(Navigator.prototype, 'onLine', {
      configurable: true,
      get: () => false,
    })

    const response = await createOfflineFetch()('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme' }),
    })

    expect(response.status).toBe(202)
    const attempted = new Headers(fetchMock.mock.calls[0][1].headers).get('Idempotency-Key')
    const queuedHeaders = Object.fromEntries(
      Object.entries(getQueue()[0].headers).map(([key, value]) => [key.toLowerCase(), value])
    )
    expect(queuedHeaders['idempotency-key']).toBe(attempted)
  })

  it('does not persist bearer or cookie headers in the offline queue', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('offline'))
    window.fetch = fetchMock as typeof window.fetch
    Object.defineProperty(Navigator.prototype, 'onLine', {
      configurable: true,
      get: () => false,
    })

    await createOfflineFetch()('/api/tasks?private=1', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret',
        Cookie: 'session=secret',
        'X-Api-Key': 'secret',
        'Content-Type': 'application/json',
      },
      body: '{}',
    })

    const persisted = Object.keys(getQueue()[0].headers).map((key) => key.toLowerCase())
    expect(persisted).not.toContain('authorization')
    expect(persisted).not.toContain('cookie')
    expect(persisted).not.toContain('x-api-key')
    expect(persisted).toContain('content-type')
  })

  it('does not replay the same queued mutation twice when flushes overlap', async () => {
    enqueue({ url: '/api/tasks', method: 'POST', headers: {}, body: '{}' })
    let resolveRequest!: (response: Response) => void
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(
      () => new Promise<Response>((resolve) => { resolveRequest = resolve }),
    )

    const first = flushQueue()
    const second = flushQueue()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveRequest(new Response('{}', { status: 201 }))
    await Promise.all([first, second])
    expect(getQueue()).toHaveLength(0)
  })
})
