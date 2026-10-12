import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'
import {getIssuer} from '@/lib/mcp/resource'
import {CompanionError} from '@/lib/companion/auth'
import {revokeCompanionDevice} from '@/lib/companion/devices'
import {companionErrorResponse, companionJson} from '@/lib/companion/http'
export const dynamic = 'force-dynamic'

export async function POST(request:Request, context:{params:Promise<{id:string}>}) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) throw new CompanionError(401, 'unauthorized')
    if (request.headers.get('origin') !== new URL(getIssuer()).origin) throw new CompanionError(403, 'invalid_origin')
    const {id} = await context.params
    await revokeCompanionDevice(session.user.id, id)
    return companionJson({revoked:true})
  } catch (error) {return companionErrorResponse(error)}
}
