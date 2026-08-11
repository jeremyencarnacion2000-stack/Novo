const MAX_MCP_REQUEST_BYTES = 64 * 1024

type PreparedMcpRequest =
  | { ok: true; request: Request }
  | { ok: false; response: Response }

function jsonError(status: number, error: string): PreparedMcpRequest {
  return {
    ok: false,
    response: new Response(JSON.stringify({ error }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  }
}

/**
 * Enforces limits before the MCP SDK consumes a request body. We rebuild POST
 * requests after reading them so downstream transport code receives the exact
 * bounded payload, even when a client omits Content-Length.
 */
export async function prepareMcpRequest(req: Request): Promise<PreparedMcpRequest> {
  if (req.method !== 'POST') return { ok: true, request: req }

  const declaredLength = Number(req.headers.get('content-length') || 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MCP_REQUEST_BYTES) {
    return jsonError(413, 'payload_too_large')
  }

  const bytes = await req.arrayBuffer()
  if (bytes.byteLength > MAX_MCP_REQUEST_BYTES) {
    return jsonError(413, 'payload_too_large')
  }

  try {
    if (Array.isArray(JSON.parse(new TextDecoder().decode(bytes)))) {
      return jsonError(400, 'batch_requests_not_supported')
    }
  } catch {
    // The MCP SDK returns the protocol error for malformed JSON.
  }

  return {
    ok: true,
    request: new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: bytes,
    }),
  }
}
