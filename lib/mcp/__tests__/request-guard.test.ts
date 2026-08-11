/** @jest-environment node */

import { prepareMcpRequest } from '../request-guard'

describe('prepareMcpRequest', () => {
  it('rejects a chunked MCP JSON-RPC request whose body exceeds the server limit', async () => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', padding: 'x'.repeat(64 * 1024) })
    const request = new Request('https://novo.test/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    })

    const result = await prepareMcpRequest(request)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(413)
      await expect(result.response.json()).resolves.toEqual({ error: 'payload_too_large' })
    }
  })

  it('rejects JSON-RPC batches so one HTTP request cannot run multiple tools', async () => {
    const request = new Request('https://novo.test/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([
        { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'read_tasks' } },
        { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'read_tasks' } },
      ]),
    })

    const result = await prepareMcpRequest(request)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(400)
      await expect(result.response.json()).resolves.toEqual({ error: 'batch_requests_not_supported' })
    }
  })
})
