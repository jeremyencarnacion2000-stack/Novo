import {CompanionError} from './auth'

export function companionJson(body:unknown, status = 200): Response {
  return Response.json(body, {status, headers:{'Cache-Control':'no-store'}})
}
export function companionErrorResponse(error:unknown): Response {
  return error instanceof CompanionError ? companionJson({error:error.code}, error.status)
    : companionJson({error:'companion_unavailable'}, 503)
}

/** Limits streamed bytes before buffering; Content-Length is not authority. */
export async function readCompanionJson(request:Request, limit = 64 * 1024): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > limit) throw new CompanionError(413, 'payload_too_large')
  if (!request.body) throw new CompanionError(400, 'invalid_request')
  const reader = request.body.getReader(), chunks:Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const {done, value} = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > limit) {await reader.cancel(); throw new CompanionError(413, 'payload_too_large')}
      chunks.push(value)
    }
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.length}
    try {return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes))}
    catch {throw new CompanionError(400, 'invalid_request')}
  } finally {reader.releaseLock()}
}
