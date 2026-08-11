import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { trackNovoLoopEvent } from '@/lib/cognitive/events'

export type McpActor = {
  userId: string
  clientId: string
  tokenId?: string
}

export async function recordMcpSecurityEvent(input: { eventType: string; clientId?: string; reason?: string }) {
  const securityEventModel = (prisma as typeof prisma & { mcpSecurityEvent?: { create: (args: unknown) => Promise<unknown> } }).mcpSecurityEvent
  if (!securityEventModel?.create) return undefined
  return securityEventModel.create({
    data: {
      eventType: input.eventType.slice(0, 80),
      clientId: input.clientId?.replace(/[^a-zA-Z0-9:._-]/g, '').slice(0, 120) || undefined,
      reason: input.reason?.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80) || undefined,
      requestId: randomUUID(),
    },
  }).catch(() => undefined)
}

type AuditInput = {
  actor: McpActor
  tool: string
  action: string
  resourceType: string
  idempotencyKey?: string
}

function safeSummary(value: string) {
  return value.replace(/[\r\n]+/g, ' ').slice(0, 180)
}

/**
 * Claims a mutating MCP request before the write. A duplicate key returns the
 * original audit record so a retry cannot duplicate the underlying mutation.
 */
export async function claimMcpMutation(input: AuditInput) {
  if (!input.idempotencyKey) throw new Error('idempotency_key_required')
  try {
    const audit = await prisma.mcpAuditLog.create({
      data: {
        userId: input.actor.userId,
        tokenId: input.actor.tokenId,
        clientId: input.actor.clientId,
        tool: input.tool,
        action: input.action,
        resourceType: input.resourceType,
        idempotencyKey: input.idempotencyKey,
        requestId: randomUUID(),
      },
    })
    await trackNovoLoopEvent(input.actor.userId, 'mcp_tool_invoked', {
      tool: input.tool,
      action: input.action,
      resourceType: input.resourceType,
      clientId: input.actor.clientId,
    }).catch(() => undefined)
    return { audit, duplicate: false as const }
  } catch (error: any) {
    if (error?.code !== 'P2002') throw error
    const audit = await prisma.mcpAuditLog.findFirst({
      where: { userId: input.actor.userId, clientId: input.actor.clientId, idempotencyKey: input.idempotencyKey },
    })
    if (!audit) throw error
    return { audit, duplicate: true as const }
  }
}

export async function finishMcpAudit(id: string, result: {
  resourceId?: string
  summary: string
  failed?: boolean
  safeErrorCode?: string
}) {
  const audit = await prisma.mcpAuditLog.update({
    where: { id },
    data: {
      resourceId: result.resourceId,
      resultStatus: result.failed ? 'failed' : 'succeeded',
      safeErrorCode: result.safeErrorCode,
      resultSummary: safeSummary(result.summary),
      completedAt: new Date(),
    },
  })
  await trackNovoLoopEvent(audit.userId, 'mcp_tool_completed', {
    tool: audit.tool,
    action: audit.action,
    resourceType: audit.resourceType,
    result: audit.resultStatus,
    safeErrorCode: audit.safeErrorCode ?? undefined,
    clientId: audit.clientId,
  }).catch(() => undefined)
  return audit
}

export async function auditMcpRead(input: Omit<AuditInput, 'idempotencyKey'> & {
  resourceId?: string
  summary: string
}) {
  const audit = await prisma.mcpAuditLog.create({
    data: {
      userId: input.actor.userId,
      tokenId: input.actor.tokenId,
      clientId: input.actor.clientId,
      tool: input.tool,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      resultStatus: 'succeeded',
      resultSummary: safeSummary(input.summary),
      requestId: randomUUID(),
      completedAt: new Date(),
    },
  })
  await trackNovoLoopEvent(input.actor.userId, 'mcp_tool_invoked', {
    tool: input.tool,
    action: input.action,
    resourceType: input.resourceType,
    clientId: input.actor.clientId,
  }).catch(() => undefined)
  await trackNovoLoopEvent(input.actor.userId, 'mcp_tool_completed', {
    tool: input.tool,
    action: input.action,
    resourceType: input.resourceType,
    result: 'succeeded',
    clientId: input.actor.clientId,
  }).catch(() => undefined)
  return audit
}
