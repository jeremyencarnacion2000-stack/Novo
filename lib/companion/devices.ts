import {randomUUID} from 'node:crypto'
import type {CompanionDevice, Prisma} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '@/lib/prisma'
import {CompanionError, type CompanionOAuthPrincipal} from './auth'
import {companionDeviceViewSchema, type CompanionDeviceView} from './contracts'

export const companionDeviceRegistrationSchema = z.object({
  deviceId:z.string().uuid(), name:z.string().trim().min(1).max(80),
  platform:z.literal('windows'), reconnect:z.boolean(),
}).strict()

function deviceView(row: CompanionDevice): CompanionDeviceView {
  return companionDeviceViewSchema.parse({id:row.deviceId, name:row.name, platform:row.platform,
    scopes:row.scopes, connectedAt:row.connectedAt.toISOString(), lastVerifiedAt:row.lastVerifiedAt.toISOString(),
    revokedAt:row.revokedAt?.toISOString() ?? null})
}
const deviceKey = (userId:string, deviceId:string) => ({userId_deviceId:{userId, deviceId}})
async function lockDevice(tx:Prisma.TransactionClient, userId:string, deviceId:string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`project-memory:${userId}`}))`
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`novo:device:${userId}:${deviceId}`}, 0))`
}
async function stopDeviceWork(tx:Prisma.TransactionClient,userId:string,deviceId:string){
  await tx.projectDelegation.updateMany({where:{userId,deviceId,enabled:true},data:{enabled:false,version:{increment:1}}})
  await tx.projectWork.updateMany({where:{userId,deviceId,phase:{in:['running','awaiting_confirmation']}},data:{phase:'uncertain',reasonCode:'device_revoked',revision:{increment:1}}})
  await tx.projectWork.updateMany({where:{userId,deviceId,phase:{in:['pending','waiting_device']}},data:{reasonCode:'device_revoked',revision:{increment:1}}})
}
async function revokeGrant(tx:Prisma.TransactionClient, userId:string, grantId:string) {
  await tx.oAuthModel.deleteMany({where:{accountId:userId, OR:[{grantId}, {type:'Grant', modelId:grantId}]}})
}
async function auditDevice(tx:Prisma.TransactionClient, actor:{userId:string; clientId:string}, deviceId:string, action:string) {
  await tx.mcpAuditLog.create({data:{userId:actor.userId, clientId:actor.clientId, tool:'companion_device', action,
    resourceType:'companion_device', resourceId:deviceId, requestId:randomUUID(),
    resultStatus:'succeeded', resultSummary:'Device authorization updated', completedAt:new Date()}})
}

export async function registerCompanionDevice(actor:CompanionOAuthPrincipal, input:z.infer<typeof companionDeviceRegistrationSchema>): Promise<CompanionDeviceView> {
  if (!actor.scopes.has('device:connect')) throw new CompanionError(403, 'permission_required')
  const parsed = companionDeviceRegistrationSchema.safeParse(input)
  if (!parsed.success) throw new CompanionError(400, 'invalid_device')
  const {deviceId, name, platform, reconnect} = parsed.data
  return prisma.$transaction(async tx => {
    await lockDevice(tx, actor.userId, deviceId)
    const current = await tx.companionDevice.findUnique({where:deviceKey(actor.userId, deviceId)})
    if (current?.grantId === actor.grantId && current.clientId === actor.clientId) {
      if (current.revokedAt) throw new CompanionError(403, 'device_revoked')
      return deviceView(current)
    }
    if (current && !reconnect) throw new CompanionError(409, 'reconnect_required')
    if(actor.grantId.startsWith('pat:')){
      // A personal token is a credential, not a reusable OAuth grant. Bind it
      // to one desktop identity so revoking that device cannot be bypassed by
      // replaying the PAT with a newly generated device UUID.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`novo:credential:${actor.userId}:${actor.grantId}`}, 0))`
      const binding=await tx.companionDevice.findFirst({where:{userId:actor.userId,clientId:actor.clientId,grantId:actor.grantId},select:{deviceId:true,revokedAt:true}})
      if(binding && binding.deviceId!==deviceId)throw new CompanionError(binding.revokedAt?403:409,binding.revokedAt?'device_revoked':'device_already_bound')
    }
    const now = new Date()
    if (current) {
      await revokeGrant(tx, actor.userId, current.grantId)
      await tx.companionWorkContext.deleteMany({ where: { userId: actor.userId, sourceDeviceId: deviceId } })
      await tx.projectAssistantSource.updateMany({where:{userId:actor.userId,deviceId},data:{facts:{},availability:'revoked'}})
      await stopDeviceWork(tx,actor.userId,deviceId)
    }
    const data = {name, platform, clientId:actor.clientId, grantId:actor.grantId,
      scopes:[...actor.scopes].sort(), connectedAt:now, lastVerifiedAt:now, revokedAt:null,workCapabilities:[],workLastSeenAt:null}
    const record = current
      ? await tx.companionDevice.update({where:deviceKey(actor.userId, deviceId), data})
      : await tx.companionDevice.create({data:{userId:actor.userId, deviceId, ...data}})
    await auditDevice(tx, actor, deviceId, current ? 'reconnect' : 'register')
    return deviceView(record)
  })
}

export async function requireActiveCompanionDevice(actor:CompanionOAuthPrincipal, deviceId:string | null): Promise<CompanionDeviceView> {
  if (!deviceId || !z.string().uuid().safeParse(deviceId).success) throw new CompanionError(400, 'device_id_required')
  const device = await prisma.companionDevice.findUnique({where:deviceKey(actor.userId, deviceId)})
  if (!device) throw new CompanionError(404, 'device_not_found')
  if (device.revokedAt) throw new CompanionError(403, 'device_revoked')
  if (device.clientId !== actor.clientId || device.grantId !== actor.grantId) throw new CompanionError(403, 'device_authorization_mismatch')
  const now = new Date(), stale = new Date(now.getTime() - 5*60_000)
  if (device.lastVerifiedAt <= stale) {
    const updated = await prisma.companionDevice.updateMany({where:{userId:actor.userId, deviceId, clientId:actor.clientId,
      grantId:actor.grantId, revokedAt:null, lastVerifiedAt:{lte:stale}}, data:{lastVerifiedAt:now}})
    if (updated.count) device.lastVerifiedAt = now
  }
  return deviceView(device)
}

export async function listCompanionDevices(userId:string): Promise<CompanionDeviceView[]> {
  const records = await prisma.companionDevice.findMany({where:{userId}, orderBy:{connectedAt:'desc'}, take:100})
  return records.map(deviceView)
}

export async function revokeCompanionDevice(userId:string, id:string): Promise<void> {
  if (!z.string().uuid().safeParse(id).success) throw new CompanionError(400, 'invalid_device')
  await prisma.$transaction(async tx => {
    await lockDevice(tx, userId, id)
    const device = await tx.companionDevice.findUnique({where:deviceKey(userId, id)})
    if (!device) throw new CompanionError(404, 'device_not_found')
    if (device.revokedAt) return
    await revokeGrant(tx, userId, device.grantId)
    await tx.companionWorkContext.deleteMany({ where: { userId, sourceDeviceId: id } })
    await tx.projectAssistantSource.updateMany({where:{userId,deviceId:id},data:{facts:{},availability:'revoked'}})
    await stopDeviceWork(tx,userId,id)
    await tx.companionDevice.update({where:deviceKey(userId, id), data:{revokedAt:new Date(),workCapabilities:[],workLastSeenAt:null}})
    await auditDevice(tx, {userId, clientId:device.clientId}, id, 'revoke')
  })
}
