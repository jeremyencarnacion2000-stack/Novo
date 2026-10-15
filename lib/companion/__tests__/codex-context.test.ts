import { codexContextInputSchema, codexSignalUpdates } from '../codex-context'

const base = {
  sessionKey: 'a'.repeat(64),
  event: 'prompt' as const,
  projectLabel: 'novo-web',
  summary: 'Fix the Twin context bridge',
  observedAt: '2026-10-14T10:00:00.000Z',
}

describe('Codex context contract', () => {
  it('accepts only a hashed session key and a short, local-safe project summary', () => {
    expect(codexContextInputSchema.safeParse(base).success).toBe(true)
    expect(codexContextInputSchema.safeParse({ ...base, sessionKey: 'raw-codex-session-id' }).success).toBe(false)
    expect(codexContextInputSchema.safeParse({ ...base, projectLabel: 'C:\\Users\\Angel\\novo-web' }).success).toBe(false)
    expect(codexContextInputSchema.safeParse({ ...base, summary: 'Send https://example.com/token' }).success).toBe(false)
    expect(codexContextInputSchema.safeParse({ ...base, summary: 'Read C:/Users/Angel/project/.env' }).success).toBe(false)
    expect(codexContextInputSchema.safeParse({ ...base, summary: 'api_key=private-value' }).success).toBe(false)
    expect(codexContextInputSchema.safeParse({ ...base, unexpected: 'raw prompt' }).success).toBe(false)
  })

  it('creates a stable, owner-neutral key per session and separates intent, result, and status', () => {
    const prompt = codexSignalUpdates(codexContextInputSchema.parse(base))
    expect(prompt).toEqual([
      expect.objectContaining({ fingerprint: `codex:${base.sessionKey}:codex_task`, signalType: 'codex_task', label: 'Tarea de Codex · novo-web: Fix the Twin context bridge' }),
      expect.objectContaining({ fingerprint: `codex:${base.sessionKey}:codex_result`, signalType: 'codex_result', label: 'Codex sigue trabajando · novo-web' }),
      expect.objectContaining({ fingerprint: `codex:${base.sessionKey}:codex_status`, signalType: 'codex_status', label: 'Tarea de Codex en curso · novo-web' }),
    ])

    const result = codexSignalUpdates(codexContextInputSchema.parse({ ...base, event: 'stop', summary: 'Completed the integration safely' }))
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ fingerprint: `codex:${base.sessionKey}:codex_result`, signalType: 'codex_result' })
    expect(result[0].label).toContain('Completed the integration safely')
    expect(result[1].signalType).toBe('codex_status')
  })
})
