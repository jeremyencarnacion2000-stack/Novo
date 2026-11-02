import { act, renderHook } from '@testing-library/react'
import { randomUUID } from 'node:crypto'
import { ChatbotProvider, useChatbot } from '../context'

let mockSession = { data: { user: { id: 'user-a' } }, status: 'authenticated' }
jest.mock('next-auth/react', () => ({ useSession: () => mockSession }))
jest.mock('@/lib/sileo-bell', () => ({ sileo: { error: jest.fn(), success: jest.fn() } }))

const timestamp = '2026-11-02T00:00:00.000Z'
const metadata = (id: string) => ({ id, title: `Chat ${id}`, revision: 4, createdAt: timestamp, updatedAt: timestamp })
const message = (id: string, content = `Message ${id}`) => ({ id, role: 'user' as const, content, timestamp })
const detail = (id: string) => ({ ...metadata(id), messages: [message(id)] })
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data, headers: { get: () => null } }) as unknown as Response
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}
async function settle() {
  await act(async () => { for (let index = 0; index < 8; index++) await Promise.resolve() })
}
async function advance(milliseconds = 2500) {
  await act(async () => { jest.advanceTimersByTime(milliseconds); for (let index = 0; index < 8; index++) await Promise.resolve() })
}
function setup(rows: unknown[] | (() => unknown[]), read: (id: string) => Promise<Response>, remove?: () => Promise<Response>, billing = Promise.resolve(response({ plan: 'free' }))) {
  const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((input, options) => {
    const url = String(input)
    const method = options?.method ?? 'GET'
    if (url === '/api/billing/status') return billing
    if (method === 'DELETE') return remove ? remove() : Promise.resolve(response({ success: true }))
    if (method === 'PUT' || method === 'POST' && url === '/api/ai-conversations') return Promise.resolve(response({ revision: 5 }))
    if (url === '/api/ai/stream') return Promise.resolve(response({ error: 'fixture unavailable' }, 503))
    if (url === '/api/ai-conversations' || url === '/api/ai-conversations?view=summary') return Promise.resolve(response(typeof rows === 'function' ? rows() : rows))
    if (url.startsWith('/api/ai-conversations/')) return read(decodeURIComponent(url.slice('/api/ai-conversations/'.length)))
    throw new Error(`Unexpected fixture request: ${url}`)
  })
  return { fetchMock, ...renderHook(() => useChatbot(), { wrapper: ChatbotProvider }) }
}
const writes = (fetchMock: ReturnType<typeof setup>['fetchMock']) => fetchMock.mock.calls.filter(([, options]) => ['PUT', 'POST'].includes(options?.method ?? ''))

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: randomUUID })
  localStorage.clear()
  mockSession = { data: { user: { id: 'user-a' } }, status: 'authenticated' }
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers() })

it('lists metadata and loads only the selected history, with no writes during hydration', async () => {
  const first = deferred<Response>()
  const { result, fetchMock } = setup([metadata('a'), metadata('b')], () => first.promise)
  await settle()
  expect(fetchMock).toHaveBeenCalledWith('/api/ai-conversations?view=summary', expect.anything())
  expect(result.current.historyStatus).toBe('loading')
  expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/ai-conversations/'))).toHaveLength(1)
  await advance()
  expect(writes(fetchMock)).toHaveLength(0)
  first.resolve(response(detail('a')))
  await settle()
  expect(result.current.historyStatus).toBe('ready')
  expect(result.current.messages).toMatchObject([message('a')])
  await advance()
  expect(writes(fetchMock)).toHaveLength(0)
})

it('never autosaves unread named conversations when another loaded conversation changes', async () => {
  const { result, fetchMock } = setup([metadata('a'), metadata('b')], async id => response(detail(id)))
  await settle()
  act(() => result.current.updateConversation('a', { title: 'Edited A' }))
  await advance()
  const saved = writes(fetchMock)
  expect(saved).toHaveLength(1)
  expect(saved[0][0]).toBe('/api/ai-conversations/a')
  expect(JSON.parse(String((saved[0][1] as RequestInit).body))).toMatchObject({ messages: [message('a')], expectedRevision: 4 })
})

it('does not suppress a pending save when another history finishes loading', async () => {
  const second = deferred<Response>()
  const { result, fetchMock } = setup([metadata('a'), metadata('b')], id => id === 'a' ? Promise.resolve(response(detail(id))) : second.promise)
  await settle()
  act(() => result.current.updateConversation('a', { title: 'Unsaved A' }))
  act(() => result.current.setCurrentConversationId('b'))
  await settle()
  second.resolve(response(detail('b')))
  await settle()
  await advance()
  expect(writes(fetchMock).map(([url]) => url)).toEqual(['/api/ai-conversations/a'])
})

it('aborts and ignores a late detail after selecting a different conversation', async () => {
  const first = deferred<Response>()
  const { result, fetchMock } = setup([metadata('a'), metadata('b')], id => id === 'a' ? first.promise : Promise.resolve(response(detail(id))))
  await settle()
  act(() => result.current.setCurrentConversationId('b'))
  await settle()
  first.resolve(response(detail('a')))
  await settle()
  expect(result.current.currentConversationId).toBe('b')
  expect(result.current.messages).toMatchObject([message('b')])
  const firstOptions = fetchMock.mock.calls.find(([url]) => url === '/api/ai-conversations/a')?.[1]
  expect(firstOptions?.signal?.aborted).toBe(true)
  expect(result.current.conversations.find(c => c.id === 'a')?.messagesLoaded).toBe(false)
})

it('keeps a new local conversation when an older detail resolves', async () => {
  const first = deferred<Response>()
  const { result, fetchMock } = setup([metadata('a')], () => first.promise)
  await settle()
  act(() => result.current.createConversation())
  const createdId = result.current.currentConversationId
  expect(createdId).not.toBe('a')
  first.resolve(response(detail('a')))
  await settle()
  expect(result.current.currentConversationId).toBe(createdId)
  expect(result.current.messages).toEqual([])
  expect(result.current.historyStatus).toBe('ready')
  await advance()
  expect(writes(fetchMock)).toHaveLength(0)
})

it('does not resurrect a deleted conversation from its late detail', async () => {
  const first = deferred<Response>()
  const { result } = setup([metadata('a'), metadata('b')], id => id === 'a' ? first.promise : Promise.resolve(response(detail(id))))
  await settle()
  await act(async () => result.current.deleteConversation('a'))
  await settle()
  first.resolve(response(detail('a')))
  await settle()
  expect(result.current.conversations.map(c => c.id)).toEqual(['b'])
  expect(result.current.messages).toMatchObject([message('b')])
})

it('ignores an old account detail and failed-delete rollback after account switch', async () => {
  const deletion = deferred<Response>()
  const oldDetail = deferred<Response>()
  const { result, rerender } = setup(() => [metadata(mockSession.data.user.id === 'user-a' ? 'a' : 'b')], id => id === 'a' ? oldDetail.promise : Promise.resolve(response(detail(id))), () => deletion.promise)
  await settle()
  let deleting!: Promise<void>
  act(() => { deleting = result.current.deleteConversation('a') })
  mockSession = { data: { user: { id: 'user-b' } }, status: 'authenticated' }
  rerender()
  await settle()
  deletion.resolve(response({}, 500))
  oldDetail.resolve(response(detail('a')))
  await act(async () => { await deleting })
  await settle()
  expect(result.current.conversations.map(c => c.id)).toEqual(['b'])
  expect(result.current.messages).toMatchObject([message('b')])
})

it('offers retry and blocks sending or replacing a history until it loads', async () => {
  let attempts = 0
  const { result, fetchMock } = setup([metadata('a')], async id => ++attempts === 1 ? response({}, 500) : response(detail(id)))
  await settle()
  expect(result.current.historyStatus).toBe('error')
  await act(async () => {
    result.current.updateConversation('a', { messages: [message('injected')] })
    await result.current.sendMessage('Do not send yet')
  })
  await advance()
  expect(writes(fetchMock)).toHaveLength(0)
  expect(result.current.messages).toEqual([])
  act(() => result.current.retryHistoryLoad())
  await settle()
  expect(attempts).toBe(2)
  expect(result.current.historyStatus).toBe('ready')
  expect(result.current.messages).toMatchObject([message('a')])
})

it('preserves extensions and sends the complete loaded history', async () => {
  const extended = { ...message('prior'), role: 'assistant', attachments: [{ id: 'file', name: 'notes.pdf', url: 'data:fixture', type: 'application/pdf' }], blocks: [{ id: 'review', type: 'text', content: 'Preserved' }], sources: [{ id: 'gmail', label: 'Gmail' }], liked: true }
  const { result, fetchMock } = setup([metadata('a')], async () => response({ ...detail('a'), messages: [message('first'), extended] }))
  await settle()
  expect(result.current.messages[1]).toMatchObject(extended)
  await act(async () => result.current.sendMessage('Continue'))
  const sent = fetchMock.mock.calls.find(([url]) => url === '/api/ai/stream')
  expect(JSON.parse(String(sent?.[1]?.body)).history).toEqual([{ role: 'user', content: 'Message first' }, { role: 'assistant', content: 'Message prior' }, { role: 'user', content: 'Continue' }])
})

it('reuses a loaded history after switching back to it', async () => {
  const { result, fetchMock } = setup([metadata('a'), metadata('b')], async id => response(detail(id)))
  await settle()
  act(() => result.current.setCurrentConversationId('b'))
  await settle()
  act(() => result.current.setCurrentConversationId('a'))
  await settle()
  expect(result.current.messages).toMatchObject([message('a')])
  expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/ai-conversations/'))).toHaveLength(2)
})

it('does not execute an action from a callback captured before changing the selection', async () => {
  const action = { ...message('action'), role: 'assistant', blocks: [{ id: 'confirm', type: 'confirmation', content: { type: 'CREATE_TASK', payload: { title: 'Fixture' } }, status: 'waiting' }] }
  const pending = deferred<Response>()
  const { result, fetchMock } = setup([metadata('a'), metadata('b')], id => id === 'a' ? Promise.resolve(response({ ...detail(id), messages: [action] })) : pending.promise)
  await settle()
  const staleConfirm = result.current.confirmAction
  act(() => result.current.setCurrentConversationId('b'))
  await act(async () => staleConfirm('action', 'confirm'))
  expect(fetchMock.mock.calls.some(([url]) => url === '/api/ai/execute')).toBe(false)
})

it('accepts the existing full-list contract during a rolling deployment', async () => {
  const { result, fetchMock } = setup([detail('a')], async () => { throw new Error('A complete history needs no detail read') })
  await settle()
  expect(result.current.messages).toMatchObject([message('a')])
  expect(result.current.historyStatus).toBe('ready')
  await advance()
  expect(writes(fetchMock)).toHaveLength(0)
})

it('retries an unavailable list without enabling a write against missing history', async () => {
  const { result, fetchMock, rerender } = setup([], async id => response(detail(id)))
  await settle()
  let attempts = 0
  const implementation = fetchMock.getMockImplementation()!
  fetchMock.mockImplementation((input, options) => String(input) === '/api/ai-conversations?view=summary'
    ? Promise.resolve(++attempts === 1 ? response({}, 500) : response([metadata('b')])) : implementation(input, options))
  mockSession = { data: { user: { id: 'user-b' } }, status: 'authenticated' }
  rerender()
  await settle()
  expect(result.current.historyStatus).toBe('error')
  await act(async () => result.current.sendMessage('Blocked until list retry'))
  expect(writes(fetchMock)).toHaveLength(0)
  act(() => result.current.retryHistoryLoad())
  await settle()
  expect(attempts).toBe(2)
  expect(result.current.historyStatus).toBe('ready')
  expect(result.current.messages).toMatchObject([message('b')])
})

it('waits for a pending create before deleting it, preventing late resurrection', async () => {
  const creation = deferred<Response>()
  const { result, fetchMock } = setup([], async id => response(detail(id)))
  await settle()
  const implementation = fetchMock.getMockImplementation()!
  fetchMock.mockImplementation((input, options) => options?.method === 'POST' && String(input) === '/api/ai-conversations'
    ? creation.promise : implementation(input, options))
  act(() => result.current.createConversation())
  const id = result.current.currentConversationId!
  act(() => result.current.updateConversation(id, { title: 'Pending conversation', messages: [message('draft')] }))
  await advance()
  let deletion!: Promise<void>
  act(() => { deletion = result.current.deleteConversation(id) })
  expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false)
  creation.resolve(response({ revision: 0 }, 201))
  await act(async () => { await deletion })
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(1)
  expect(result.current.conversations).toEqual([])
})

it('rejects stale new-chat and send callbacks when both accounts have an empty list', async () => {
  const { result, fetchMock, rerender } = setup([], async id => response(detail(id)))
  await settle()
  const oldSend = result.current.sendMessage
  const oldCreate = result.current.createConversation
  mockSession = { data: { user: { id: 'user-b' } }, status: 'authenticated' }
  rerender()
  await settle()
  await act(async () => { await oldSend('Private fixture from account A') })
  act(() => oldCreate())
  expect(fetchMock.mock.calls.some(([url]) => url === '/api/ai/stream')).toBe(false)
  expect(result.current.conversations).toEqual([])
})

it('keeps a pending detail request when selecting the current conversation again', async () => {
  const pending = deferred<Response>()
  const { result, fetchMock } = setup([metadata('a')], () => pending.promise)
  await settle()
  act(() => result.current.setCurrentConversationId('a'))
  pending.resolve(response(detail('a')))
  await settle()
  expect(result.current.historyStatus).toBe('ready')
  expect(result.current.messages).toMatchObject([message('a')])
  expect(fetchMock.mock.calls.filter(([url]) => url === '/api/ai-conversations/a')).toHaveLength(1)
})

it('keeps the retry state when clicking the already selected failed conversation', async () => {
  const { result } = setup([metadata('a')], async () => response({}, 500))
  await settle()
  expect(result.current.historyStatus).toBe('error')
  act(() => result.current.setCurrentConversationId('a'))
  await settle()
  expect(result.current.historyStatus).toBe('error')
})

it.each(['edit', 'retry'])('preserves the full history when %s is requested before account hydration completes', async operation => {
  const billing = deferred<Response>()
  const history = [message('question'), { ...message('answer'), role: 'assistant' as const }, message('follow-up'), { ...message('reply'), role: 'assistant' as const }]
  const { result, fetchMock } = setup([metadata('a')], async () => response({ ...detail('a'), messages: history }), undefined, billing.promise)
  await settle()
  expect(result.current.historyStatus).toBe('loading')
  expect(result.current.messages).toMatchObject(history)
  await act(async () => {
    if (operation === 'edit') await result.current.editMessage('question', 'Edited question')
    else await result.current.retryMessage('answer')
  })
  expect(result.current.messages).toMatchObject(history)
  expect(fetchMock.mock.calls.some(([url]) => url === '/api/ai/stream')).toBe(false)
  billing.resolve(response({ plan: 'free' }))
  await settle()
  await advance()
  expect(writes(fetchMock)).toHaveLength(0)
  expect(result.current.messages).toMatchObject(history)
})

it('keeps a new save tracked when an older save finishes after returning to the same account', async () => {
  const firstSave = deferred<Response>()
  const currentSave = deferred<Response>()
  const { result, fetchMock, rerender } = setup(() => [detail(mockSession.data.user.id === 'user-a' ? 'a' : 'b')], async id => response(detail(id)))
  await settle()
  let saves = 0
  const implementation = fetchMock.getMockImplementation()!
  fetchMock.mockImplementation((input, options) => options?.method === 'PUT' && String(input) === '/api/ai-conversations/a'
    ? ++saves === 1 ? firstSave.promise : currentSave.promise : implementation(input, options))
  act(() => result.current.updateConversation('a', { title: 'First pending save' }))
  await advance()
  for (const id of ['user-b', 'user-a']) {
    mockSession = { data: { user: { id } }, status: 'authenticated' }
    rerender()
    await settle()
  }
  act(() => result.current.updateConversation('a', { title: 'Current pending save' }))
  await advance()
  firstSave.resolve(response({ revision: 5 }))
  await settle()
  let deletion!: Promise<void>
  act(() => { deletion = result.current.deleteConversation('a') })
  expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false)
  currentSave.resolve(response({ revision: 5 }))
  await act(async () => { await deletion })
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(1)
})
