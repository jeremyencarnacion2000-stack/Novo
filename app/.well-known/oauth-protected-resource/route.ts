import { NextResponse } from 'next/server'
import { getIssuer, getMcpResourceUri } from '@/lib/mcp/resource'
import { MCP_SCOPES } from '@/lib/mcp/scopes'

// RFC9728 OAuth 2.0 Protected Resource Metadata — required by the MCP spec so
// clients can discover which authorization server issues tokens for this MCP
// server, before ever calling /api/mcp.
export async function GET() {
  return NextResponse.json({
    resource: getMcpResourceUri(),
    authorization_servers: [getIssuer()],
    scopes_supported: MCP_SCOPES,
    bearer_methods_supported: ['header'],
  })
}
