// Canonical identifiers for the Novo MCP OAuth server. Single source of
// truth so the AS config, the well-known metadata documents, and the MCP
// resource-server token validation all agree on the same strings — RFC8707
// audience binding depends on exact string equality here.
function origin(): string {
  return (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
}

// The OAuth 2.1 authorization server issuer — also Novo's own origin, since
// Novo hosts both the AS and the resource server (explicitly allowed by the
// MCP spec: "It may be hosted with the resource server or a separate entity").
export function getIssuer(): string {
  return origin()
}

// The canonical URI of the protected resource (the MCP endpoint itself).
// This is the RFC8707 `resource` value every issued access token must be
// audience-bound to.
export function getMcpResourceUri(): string {
  return `${origin()}/api/mcp`
}
