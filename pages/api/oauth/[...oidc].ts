import type { NextApiRequest, NextApiResponse } from 'next'
import { getOidcProvider } from '@/lib/mcp/oidc-provider'

// Mounts the oidc-provider (Koa) app's raw Node request handler. oidc-provider
// needs real http.IncomingMessage/ServerResponse — Pages Router API routes are
// the only place in this Next.js version that hand those over directly (App
// Router route handlers only see the Web Request/Response). All of
// oidc-provider's endpoints are namespaced under /api/oauth/* via the
// `routes` config in lib/mcp/oidc-provider.ts, matching this catch-all
// exactly, so no request-path rewriting is needed here.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const provider = getOidcProvider()
  return provider.callback()(req, res)
}

// oidc-provider (Koa) parses the request body itself; Next.js's default
// body parsing would consume the stream first and break it.
export const config = {
  api: {
    bodyParser: false,
  },
}
