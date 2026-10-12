import { MCP_SCOPES, MCP_SCOPE_DESCRIPTIONS } from '../scopes'

describe('Companion OAuth scopes', () => {
  it('supports explicit device connection and AI chat permissions', () => {
    expect(MCP_SCOPES).toContain('device:connect')
    expect(MCP_SCOPES).toContain('ai:chat')
    expect(MCP_SCOPE_DESCRIPTIONS['device:connect']).toMatch(/dispositivo|companion/i)
    expect(MCP_SCOPE_DESCRIPTIONS['ai:chat']).toMatch(/chat/i)
  })

  it('describes activity observation as a distinct, limited permission', () => {
    expect(MCP_SCOPES).toContain('device:activity:write')
    expect(MCP_SCOPE_DESCRIPTIONS['device:activity:write']).toMatch(/aplicaci[oó]n|duraci[oó]n/i)
    expect(MCP_SCOPE_DESCRIPTIONS['device:activity:write']).not.toMatch(/tareas|escribir|editar/i)
  })
})
