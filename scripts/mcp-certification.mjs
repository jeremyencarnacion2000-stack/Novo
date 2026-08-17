#!/usr/bin/env node

/**
 * Read-only external MCP smoke harness.
 *
 * Required environment:
 *   NOVO_MCP_ENDPOINT  e.g. http://localhost:3000/api/mcp
 *   NOVO_MCP_TOKEN     Novo-issued PAT (never printed)
 *
 * Optional flag:
 *   --read-tasks       call read_tasks after tools/list
 *
 * This script intentionally does not call any mutating MCP tool.
 */

const endpoint = process.env.NOVO_MCP_ENDPOINT
const token = process.env.NOVO_MCP_TOKEN

if (!endpoint || !token) {
  console.error('Set NOVO_MCP_ENDPOINT and NOVO_MCP_TOKEN before running the read-only MCP check.')
  process.exit(2)
}

const headers = {
  accept: 'application/json, text/event-stream',
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
}

let nextId = 1
let sessionId

function requestHeaders() {
  return sessionId ? { ...headers, 'mcp-session-id': sessionId } : headers
}

async function call(method, params = {}, id = nextId++) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  })

  const returnedSession = response.headers.get('mcp-session-id')
  if (returnedSession) sessionId = returnedSession

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`MCP ${method} failed with HTTP ${response.status}: ${text.slice(0, 240)}`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('text/event-stream')) {
    const dataLine = text.split(/\r?\n/).find((line) => line.startsWith('data:'))
    if (!dataLine) throw new Error(`MCP ${method} returned an empty event stream.`)
    return JSON.parse(dataLine.slice(5).trim())
  }

  return text ? JSON.parse(text) : null
}

try {
  const initialized = await call('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'novo-certification-harness', version: '1.0.0' },
  })

  await call('notifications/initialized', {})
  const tools = await call('tools/list')
  const toolNames = tools?.result?.tools?.map((tool) => tool.name).filter(Boolean) || []

  console.log(`MCP initialize: PASS (${initialized?.result?.serverInfo?.name || 'server'})`)
  console.log(`tools/list: PASS (${toolNames.length} tools)`)

  if (process.argv.includes('--read-tasks')) {
    const result = await call('tools/call', {
      name: 'read_tasks',
      arguments: { status: 'all', limit: 20 },
    })
    if (result?.result?.isError) throw new Error('read_tasks returned an MCP tool error.')
    console.log('read_tasks: PASS (read-only)')
  }

  console.log('MCP CERTIFICATION CHECK: PASS')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'MCP certification check failed.')
  process.exit(1)
}

