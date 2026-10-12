import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'
import {CompanionError, requireCompanionOAuth} from '@/lib/companion/auth'
import {companionDeviceRegistrationSchema, listCompanionDevices, registerCompanionDevice} from '@/lib/companion/devices'
import {companionErrorResponse, companionJson, readCompanionJson} from '@/lib/companion/http'
export const dynamic = 'force-dynamic'

export async function POST(request:Request) {
  try {
    const actor = await requireCompanionOAuth(request, ['device:connect'])
    const parsed = companionDeviceRegistrationSchema.safeParse(await readCompanionJson(request))
    if (!parsed.success) throw new CompanionError(400, 'invalid_device')
    return companionJson(await registerCompanionDevice(actor, parsed.data))
  } catch (error) {return companionErrorResponse(error)}
}
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) throw new CompanionError(401, 'unauthorized')
    return companionJson({devices:await listCompanionDevices(session.user.id)})
  } catch (error) {return companionErrorResponse(error)}
}
