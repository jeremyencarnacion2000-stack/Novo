import { prisma } from '@/lib/prisma'

// oidc-provider Adapter implementation backed by Prisma/Postgres (the
// OAuthModel table). oidc-provider's adapter interface is model-agnostic —
// the same 7 methods store every kind (Client, Grant, AccessToken,
// AuthorizationCode, RefreshToken, Interaction, Session, DeviceCode, ...)
// keyed by `name` (the model kind) + `id` (the library's own opaque id).
// See: https://github.com/panva/node-oidc-provider/blob/main/example/my_adapter.js
export class PrismaOidcAdapter {
  constructor(private name: string) {}

  async upsert(id: string, payload: Record<string, unknown>, expiresIn?: number) {
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null
    const data = {
      payload: payload as any,
      grantId: (payload.grantId as string | undefined) ?? null,
      userCode: (payload.userCode as string | undefined) ?? null,
      uid: (payload.uid as string | undefined) ?? null,
      accountId: (payload.accountId as string | undefined) ?? null,
      expiresAt,
    }
    await prisma.oAuthModel.upsert({
      where: { type_modelId: { type: this.name, modelId: id } },
      create: { type: this.name, modelId: id, ...data },
      update: data,
    })
  }

  async find(id: string) {
    const row = await prisma.oAuthModel.findUnique({
      where: { type_modelId: { type: this.name, modelId: id } },
    })
    if (!row) return undefined
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return undefined
    return row.payload as Record<string, unknown>
  }

  async findByUserCode(userCode: string) {
    const row = await prisma.oAuthModel.findFirst({ where: { type: this.name, userCode } })
    if (!row) return undefined
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return undefined
    return row.payload as Record<string, unknown>
  }

  async findByUid(uid: string) {
    const row = await prisma.oAuthModel.findFirst({ where: { type: this.name, uid } })
    if (!row) return undefined
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return undefined
    return row.payload as Record<string, unknown>
  }

  async consume(id: string) {
    const row = await prisma.oAuthModel.findUnique({
      where: { type_modelId: { type: this.name, modelId: id } },
    })
    if (!row) return
    const payload = { ...(row.payload as Record<string, unknown>), consumed: Math.floor(Date.now() / 1000) }
    await prisma.oAuthModel.update({
      where: { type_modelId: { type: this.name, modelId: id } },
      data: { payload },
    })
  }

  async destroy(id: string) {
    await prisma.oAuthModel.deleteMany({ where: { type: this.name, modelId: id } })
  }

  async revokeByGrantId(grantId: string) {
    await prisma.oAuthModel.deleteMany({ where: { grantId } })
  }
}

export function oidcAdapterFactory(name: string) {
  return new PrismaOidcAdapter(name)
}
