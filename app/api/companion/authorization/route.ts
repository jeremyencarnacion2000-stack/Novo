import { NextResponse } from 'next/server'
import { validateMcpBearerToken } from '@/lib/mcp/auth'
import {prisma} from '@/lib/prisma'
import {CompanionError, requireCompanionOAuth} from '@/lib/companion/auth'
import {requireActiveCompanionDevice} from '@/lib/companion/devices'
import {companionAuthorizationSchema, companionCapabilities} from '@/lib/companion/contracts'
import {companionErrorResponse} from '@/lib/companion/http'
import {requireCompanionChatEnabled} from '@/lib/companion/feature'

export const dynamic = 'force-dynamic'

const COMPANION_SCOPES = ['device:activity:read', 'device:activity:write', 'device:work-context:read', 'device:work-context:write', 'twin:read', 'integrations:read'] as const

export async function GET(request: Request) {
  try {
    const validated = await validateMcpBearerToken(request)
    if (!validated.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })

    const scopes = Array.isArray(validated.authInfo.scopes) ? validated.authInfo.scopes : []
    if (scopes.includes('device:connect')) {
      // Candidate-only identity/capability verification precedes reconnect's
      // atomic grant replacement. It never grants device/context access or
      // advertises a connection before the registry acknowledges the binding.
      const preflight = request.headers.get('X-Novo-Authorization-Preflight') === '1'
      const actor = await requireCompanionOAuth(request, preflight ? ['device:connect','ai:chat'] : ['device:connect'])
      if (preflight) requireCompanionChatEnabled()
      const device = preflight ? null : await requireActiveCompanionDevice(actor, request.headers.get('X-Novo-Device-Id') ?? '')
      const user = await prisma.user.findUnique({where:{id:actor.userId}, select:{id:true, name:true}})
      if (!user) throw new CompanionError(401, 'unauthorized')
      const capabilities = companionCapabilities(actor.scopes)
      return NextResponse.json(companionAuthorizationSchema.parse({version:1,
        state:device && capabilities.aiChat ? 'connected' : 'permission_required',
        user:{id:user.id, displayName:user.name}, device, capabilities}), {headers:{'Cache-Control':'no-store'}})
    }
    const hasCompanionPermission = COMPANION_SCOPES.some((scope) => scopes.includes(scope))
    if (!hasCompanionPermission) {
      return NextResponse.json({ error: 'companion_permission_required' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
    }

    return NextResponse.json({
      activityRead: scopes.includes('device:activity:read'),
      activityWrite: scopes.includes('device:activity:write'),
      workContextRead: scopes.includes('device:work-context:read'),
      workContextWrite: scopes.includes('device:work-context:write'),
      contextRead: scopes.includes('twin:read'),
      integrationsRead: scopes.includes('integrations:read'),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof CompanionError) return companionErrorResponse(error)
    console.error('[companion/authorization GET] Token validation failed.')
    return NextResponse.json({ error: 'authorization_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
