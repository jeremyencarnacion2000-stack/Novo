/** @jest-environment node */
import { fallbackGmailQuery, planMailboxRead } from '../mailbox-plan'

describe('mailbox read planning', () => {
  const env = { ...process.env }
  const originalFetch = global.fetch
  afterEach(() => { process.env = { ...env }; global.fetch = originalFetch })
  it('preserves the named correspondent instead of always reading only the latest inbox', () => {
    expect(fallbackGmailQuery('Quiero que revises si MESCyT me respondió')).toBe('MESCyT')
    expect(fallbackGmailQuery('revisa mis correos recientes importantes')).toBe('newer_than:30d')
  })
  it('keeps explicit Gmail operators intact', () => {
    expect(fallbackGmailQuery('from:becas@example.test after:2026/09/01')).toContain('from:becas@example.test')
  })
  it('validates planner output and falls back safely when the model invents a write', async () => {
    process.env.GROQ_API_KEY = 'private'
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"sendEmail":true,"to":"other@example.test"}' } }] }) })
    const plan = await planMailboxRead('revisa mis correos de MESCyT')
    expect(plan.query).toBe('MESCyT')
    expect(plan).not.toHaveProperty('sendEmail')
  })
  it('uses conversation history to resolve a requested follow-up search', async () => {
    process.env.GROQ_API_KEY = 'private'
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"query":"MESCyT","maxResults":2,"expandThread":true}' } }] }) })
    const plan = await planMailboxRead('Lee toda la conversación', [{ role: 'user', content: 'Busca correos de MESCyT' }])
    expect(plan).toEqual({ query: 'MESCyT', maxResults: 2, expandThread: true })
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).messages[1].content).toContain('MESCyT')
  })
})
