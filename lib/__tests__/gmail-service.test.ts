/** @jest-environment node */
const mockList = jest.fn(), mockGet = jest.fn(), mockSend = jest.fn(), mockThread = jest.fn(), mockAttachment = jest.fn()
const mockSetCredentials = jest.fn(), mockOn = jest.fn()
jest.mock('googleapis', () => ({ google: {
  auth: { OAuth2: jest.fn(() => ({ setCredentials: mockSetCredentials, on: mockOn })) },
  gmail: jest.fn(() => ({ users: { messages: { list: mockList, get: mockGet, send: mockSend, attachments: { get: mockAttachment } }, threads: { get: mockThread } } })),
} }))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { account: { update: jest.fn() } } }))
jest.mock('@/lib/google-account', () => ({ findGoogleAccountForScopes: jest.fn(), toGoogleOAuthCredentials: jest.fn(value => ({ access_token: value.access_token, refresh_token: value.refresh_token })) }))
import { gmailService } from '../google'
import { findGoogleAccountForScopes } from '../google-account'
import { getServerSession } from 'next-auth'

describe('user-owned Gmail capabilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(findGoogleAccountForScopes as jest.Mock).mockResolvedValue({ id: 'grant', access_token: 'expired', refresh_token: 'refresh', expires_at: 1 })
  })
  it('searches the entire mailbox using the requested query and retrieves full bodies', async () => {
    mockList.mockResolvedValue({ data: { messages: [{ id: 'abc' }], nextPageToken: 'next' } })
    mockGet.mockResolvedValue({ data: { id: 'abc', payload: { mimeType: 'text/plain', body: { data: Buffer.from('Respuesta completa').toString('base64url') } } } })
    const result = await gmailService.searchForUser('owner', { query: 'MESCyT', maxResults: 3 })
    expect(mockList.mock.calls[0][0]).toMatchObject({ q: 'MESCyT', maxResults: 3, userId: 'me' })
    expect(mockGet.mock.calls[0][0]).toEqual({ userId: 'me', id: 'abc', format: 'full' })
    expect(result.messages[0].body).toBe('Respuesta completa')
    expect(result.nextPageToken).toBe('next')
    expect(findGoogleAccountForScopes).toHaveBeenCalledWith('owner', ['gmail.readonly'])
    expect(getServerSession).not.toHaveBeenCalled()
  })
  it('hydrates large text MIME parts without downloading document attachments', async () => {
    mockGet.mockResolvedValue({ data: { id: 'abc', payload: { parts: [
      { mimeType: 'text/plain', body: { attachmentId: 'body', size: 100 } },
      { mimeType: 'application/pdf', filename: 'private.pdf', body: { attachmentId: 'doc', size: 100 } },
    ] } } })
    mockAttachment.mockResolvedValue({ data: { data: Buffer.from('Full body').toString('base64url') } })
    const message = await gmailService.readMessageForUser('owner', 'abc')
    expect(message.body).toBe('Full body')
    expect(mockAttachment).toHaveBeenCalledTimes(1)
    expect(mockAttachment.mock.calls[0][0].id).toBe('body')
  })
  it('sends through a refreshable durable grant without a browser and disables provider retries', async () => {
    mockSend.mockResolvedValue({ data: { id: 'sent' } })
    await gmailService.sendEmailForUser('owner', { to: 'person@example.test', subject: 'Información', body: 'Hola' }, '<stable@novo.local>')
    expect(findGoogleAccountForScopes).toHaveBeenCalledWith('owner', ['gmail.send'])
    expect(mockSetCredentials).toHaveBeenCalledWith(expect.objectContaining({ refresh_token: 'refresh' }))
    expect(mockSend.mock.calls[0][1]).toMatchObject({ retry: false })
    expect(getServerSession).not.toHaveBeenCalled()
  })
  it('validates recipient headers before consulting Google', async () => {
    await expect(gmailService.sendEmailForUser('owner', { to: 'bad\r\nBcc: x@y.test', subject: 'Hello', body: 'Hola' })).rejects.toThrow()
    expect(findGoogleAccountForScopes).not.toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
  })
})
