import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js'
import { prisma } from '@/lib/prisma'
import { executeAIAction } from '@/lib/ai/executor'
import { validateMcpBearerToken, wwwAuthenticateHeader } from '@/lib/mcp/auth'
import { syncPlugin, syncAllPlugins, type PluginProvider } from '@/lib/plugins/plugin-orchestrator'
import { isSameDay } from 'date-fns'
import { auditMcpRead, claimMcpMutation, finishMcpAudit, recordMcpSecurityEvent, type McpActor } from '@/lib/mcp/audit'
import { rateLimit } from '@/lib/rate-limit'
import { canTransitionRecommendation, isTerminalRecommendationState } from '@/lib/cognitive/action-state-machine'
import { prepareMcpRequest } from '@/lib/mcp/request-guard'
import { runAmbientTwinForUser } from '@/lib/cognitive/ambient-twin-runtime'

export const runtime = 'nodejs'

function insufficientScope(required: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: `insufficient_scope: this tool requires the "${required}" scope.` }],
  }
}

function ok(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] }
}

function buildServer(userId: string, scopes: string[], actor: McpActor) {
  const server = new McpServer({ name: 'novo-cognitive-os', version: '2.0.0' })
  const has = (scope: string) => scopes.includes(scope)

  // ── TASK TOOLS ────────────────────────────────────────────────────────────

  server.registerTool('create_task', {
    title: 'Crear tarea',
    description: 'Crea una nueva tarea en Novo.',
    inputSchema: {
      title: z.string().min(1),
      category: z.enum(['Training', 'Study', 'Personal', 'Work']),
      priority: z.number().int().min(1).max(3).describe('1=baja 2=media 3=alta'),
      dueDate: z.string().optional().describe('ISO date string'),
      idempotencyKey: z.string().uuid(),
    },
  }, async (args): Promise<CallToolResult> => {
    if (!has('tasks:write')) return insufficientScope('tasks:write')
    const claim = await claimMcpMutation({ actor, tool: 'create_task', action: 'create', resourceType: 'task', idempotencyKey: args.idempotencyKey })
    if (claim.duplicate) return ok(JSON.stringify({ duplicate: true, taskId: claim.audit.resourceId, status: claim.audit.resultStatus }))
    try {
      const task = await prisma.task.create({ data: {
        userId, title: args.title.trim(), status: 'todo',
        priority: args.priority === 3 ? 'high' : args.priority === 2 ? 'medium' : 'low',
        dueDate: args.dueDate, tags: '[]',
      } })
      await finishMcpAudit(claim.audit.id, { resourceId: task.id, summary: 'Task created' })
      return ok(JSON.stringify({ taskId: task.id, status: task.status }))
    } catch {
      await finishMcpAudit(claim.audit.id, { summary: 'Task creation failed', failed: true, safeErrorCode: 'task_create_failed' })
      return { isError: true, content: [{ type: 'text', text: 'Task could not be created.' }] }
    }
  })

  server.registerTool('read_tasks', {
    title: 'Leer tareas',
    description: 'Consulta las tareas del usuario. Filtra por estado o fecha.',
    inputSchema: {
      status: z.enum(['todo', 'in-progress', 'done', 'all']).optional().default('all'),
      dueBefore: z.string().optional().describe('ISO date — solo tareas que vencen antes de esta fecha'),
      limit: z.number().int().min(1).max(50).optional().default(20),
    },
  }, async (args): Promise<CallToolResult> => {
    if (!has('tasks:read')) return insufficientScope('tasks:read')
    const where: any = { userId }
    if (args.status !== 'all') where.status = args.status
    if (args.dueBefore) where.dueDate = { lte: args.dueBefore }
    const [tasks, checklistItems] = await Promise.all([
      prisma.task.findMany({ where, orderBy: { createdAt: 'desc' }, take: args.limit }),
      prisma.checklistItem.findMany({
        where: {
          userId,
          ...(args.status === 'all' ? {} : { completed: args.status === 'done' }),
          ...(args.dueBefore ? { dueDate: { lte: new Date(args.dueBefore) } } : {}),
        },
        select: { id: true, text: true, completed: true, priority: true, dueDate: true, source: true, sourceId: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' }, take: args.limit,
      }),
    ])
    const normalizedChecklist = checklistItems.map((item) => ({
      id: `checklist:${item.id}`, title: item.text, status: item.completed ? 'done' : 'todo',
      priority: item.priority, dueDate: item.dueDate, source: item.source, sourceId: item.sourceId,
      updatedAt: item.updatedAt, resourceType: 'checklist_item' as const,
    }))
    const resources = [...tasks.map((task) => ({ ...task, resourceType: 'task' as const })), ...normalizedChecklist]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, args.limit)
    await auditMcpRead({ actor, tool: 'read_tasks', action: 'read', resourceType: 'task', summary: `${resources.length} task resources read` })
    return ok(JSON.stringify(resources))
  })

  server.registerTool('get_pending_tasks', {
    title: 'Ver tareas pendientes',
    description: 'Use this when you need the user\'s unfinished Novo tasks before proposing or taking a task action.',
    inputSchema: {
      limit: z.number().int().min(1).max(50).optional().default(20),
    },
    annotations: { readOnlyHint: true },
  }, async (args): Promise<CallToolResult> => {
    if (!has('tasks:read')) return insufficientScope('tasks:read')
    const [tasks, checklistItems] = await Promise.all([
      prisma.task.findMany({
        where: { userId, status: { not: 'done' } },
        select: { id: true, title: true, status: true, priority: true, dueDate: true, updatedAt: true },
        orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }], take: args.limit,
      }),
      prisma.checklistItem.findMany({
        where: { userId, completed: false },
        select: { id: true, text: true, priority: true, dueDate: true, source: true, updatedAt: true },
        orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }], take: args.limit,
      }),
    ])
    const pending = [
      ...tasks.map((task) => ({ ...task, resourceType: 'task' as const })),
      ...checklistItems.map((item) => ({
        id: `checklist:${item.id}`, title: item.text, status: 'todo', priority: item.priority,
        dueDate: item.dueDate, source: item.source, updatedAt: item.updatedAt, resourceType: 'checklist_item' as const,
      })),
    ].sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 } as Record<string, number>
      return (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3) || b.updatedAt.getTime() - a.updatedAt.getTime()
    }).slice(0, args.limit)
    await auditMcpRead({ actor, tool: 'get_pending_tasks', action: 'read', resourceType: 'task', summary: `${pending.length} pending task resources read` })
    return ok(JSON.stringify({ tasks: pending, count: pending.length }))
  })

  server.registerTool('read_objectives', {
    title: 'Ver objetivos',
    description: 'Consulta objetivos propios activos con su prioridad y fecha límite.',
    inputSchema: { limit: z.number().int().min(1).max(20).optional().default(10) },
    annotations: { readOnlyHint: true },
  }, async (args): Promise<CallToolResult> => {
    if (!has('goals:read')) return insufficientScope('goals:read')
    const goals = await prisma.goal.findMany({
      where: { userId, status: 'active' },
      select: { id: true, title: true, priority: true, deadline: true, updatedAt: true },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }], take: args.limit,
    })
    await auditMcpRead({ actor, tool: 'read_objectives', action: 'read', resourceType: 'goal', summary: `${goals.length} objectives read` })
    return ok(JSON.stringify({ goals, count: goals.length }))
  })

  server.registerTool('read_recommendations', {
    title: 'Ver recomendaciones',
    description: 'Consulta recomendaciones propias activas para registrar su resultado.',
    inputSchema: { limit: z.number().int().min(1).max(20).optional().default(10) },
    annotations: { readOnlyHint: true },
  }, async (args): Promise<CallToolResult> => {
    if (!has('recommendations:read')) return insufficientScope('recommendations:read')
    const actions = await prisma.recommendedAction.findMany({
      where: { userId, status: { in: ['proposed', 'modified', 'accepted', 'started', 'postponed'] } },
      select: { id: true, taskId: true, title: true, nextStep: true, status: true, estimatedMinutes: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' }, take: args.limit,
    })
    await auditMcpRead({ actor, tool: 'read_recommendations', action: 'read', resourceType: 'recommendation', summary: `${actions.length} recommendations read` })
    return ok(JSON.stringify({ recommendations: actions, count: actions.length }))
  })

  server.registerTool('record_recommendation_outcome', {
    title: 'Registrar resultado de recomendación',
    description: 'Registra de forma persistida el resultado de una recomendación propia.',
    inputSchema: {
      actionId: z.string().min(1),
      response: z.enum(['accepted', 'started', 'completed', 'postponed', 'abandoned', 'failed', 'dismissed', 'helpful', 'unhelpful', 'intrusive']),
      reason: z.enum(['lack_of_time', 'too_large', 'external_dependency', 'priority_changed', 'incorrect_recommendation', 'insufficient_information', 'technical_problem', 'other']).optional(),
      idempotencyKey: z.string().uuid(),
    },
  }, async (args): Promise<CallToolResult> => {
    if (!has('recommendations:update') || !has('activity:write')) return insufficientScope('recommendations:update')
    const claim = await claimMcpMutation({ actor, tool: 'record_recommendation_outcome', action: args.response, resourceType: 'recommendation', idempotencyKey: args.idempotencyKey })
    if (claim.duplicate) return ok(JSON.stringify({ duplicate: true, actionId: claim.audit.resourceId, status: claim.audit.resultStatus }))
    const action = await prisma.recommendedAction.findFirst({ where: { id: args.actionId, userId } })
    if (!action || !canTransitionRecommendation(action.status, args.response)) {
      await finishMcpAudit(claim.audit.id, { summary: 'Recommendation transition rejected', failed: true, safeErrorCode: 'invalid_recommendation_transition' })
      return { isError: true, content: [{ type: 'text', text: 'Recommendation was not found or cannot transition to that state.' }] }
    }
    const now = new Date()
    const nextStatus = ['helpful', 'unhelpful', 'intrusive'].includes(args.response) ? action.status : args.response
    await prisma.$transaction(async (tx) => {
      await tx.recommendedAction.update({ where: { id: action.id }, data: {
        status: nextStatus, statusAt: now, lastActor: 'mcp', responseAt: now,
        ...(args.response === 'started' ? { startedAt: now } : {}),
        ...(args.response === 'completed' ? { completedAt: now } : {}),
        ...(isTerminalRecommendationState(nextStatus as any) ? { terminalReason: args.reason ?? args.response } : {}),
      } })
      await tx.outcomeEvent.create({ data: {
        userId, planId: action.planId, recommendedActionId: action.id, type: args.response,
        metadata: { actor: 'mcp', ...(args.reason ? { reason: args.reason } : {}) }, idempotencyKey: args.idempotencyKey,
      } })
      if (args.response === 'completed' && action.taskId) await tx.task.updateMany({ where: { id: action.taskId, userId }, data: { status: 'done' } })
    })
    await finishMcpAudit(claim.audit.id, { resourceId: action.id, summary: `Recommendation ${args.response}` })
    void runAmbientTwinForUser(userId, { trigger: args.response === 'completed' ? 'task_completed' : 'agent_outcome' }).catch(() => undefined)
    return ok(JSON.stringify({ actionId: action.id, status: nextStatus }))
  })

  server.registerTool('complete_task', {
    title: 'Completar tarea',
    description: 'Marca una tarea como completada.',
    inputSchema: { id: z.string().min(1), idempotencyKey: z.string().uuid() },
  }, async (args): Promise<CallToolResult> => {
    if (!has('tasks:write')) return insufficientScope('tasks:write')
    const claim = await claimMcpMutation({ actor, tool: 'complete_task', action: 'complete', resourceType: 'task', idempotencyKey: args.idempotencyKey })
    if (claim.duplicate) return ok(JSON.stringify({ duplicate: true, taskId: claim.audit.resourceId, status: claim.audit.resultStatus }))
    const task = await prisma.task.findFirst({ where: { id: args.id, userId }, select: { id: true, title: true } })
    if (!task) {
      await finishMcpAudit(claim.audit.id, { summary: 'Task not found', failed: true, safeErrorCode: 'task_not_found' })
      return { isError: true, content: [{ type: 'text', text: 'Task not found.' }] }
    }
    await prisma.task.update({ where: { id: task.id }, data: { status: 'done' } })
    await finishMcpAudit(claim.audit.id, { resourceId: task.id, summary: 'Task completed' })
    void runAmbientTwinForUser(userId, { trigger: 'task_completed' }).catch(() => undefined)
    return ok(`Tarea "${task.title}" marcada como completada.`)
  })

  server.registerTool('start_task', {
    title: 'Iniciar tarea',
    description: 'Marca una tarea propia como iniciada.',
    inputSchema: { id: z.string().min(1), idempotencyKey: z.string().uuid() },
  }, async (args): Promise<CallToolResult> => {
    if (!has('tasks:write')) return insufficientScope('tasks:write')
    const claim = await claimMcpMutation({ actor, tool: 'start_task', action: 'start', resourceType: 'task', idempotencyKey: args.idempotencyKey })
    if (claim.duplicate) return ok(JSON.stringify({ duplicate: true, taskId: claim.audit.resourceId, status: claim.audit.resultStatus }))
    const task = await prisma.task.findFirst({ where: { id: args.id, userId }, select: { id: true } })
    if (!task) {
      await finishMcpAudit(claim.audit.id, { summary: 'Task not found', failed: true, safeErrorCode: 'task_not_found' })
      return { isError: true, content: [{ type: 'text', text: 'Task not found.' }] }
    }
    await prisma.task.update({ where: { id: task.id }, data: { status: 'in-progress' } })
    await finishMcpAudit(claim.audit.id, { resourceId: task.id, summary: 'Task started' })
    void runAmbientTwinForUser(userId, { trigger: 'agent_outcome' }).catch(() => undefined)
    return ok(JSON.stringify({ taskId: task.id, status: 'in-progress' }))
  })

  server.registerTool('update_task', {
    title: 'Actualizar tarea',
    description: 'Actualiza campos de una tarea existente.',
    inputSchema: {
      id: z.string().min(1),
      updates: z.object({
        title: z.string().optional(),
        status: z.enum(['todo', 'in-progress', 'done']).optional(),
        priority: z.number().int().min(1).max(3).optional(),
        dueDate: z.string().optional(),
      }),
      idempotencyKey: z.string().uuid(),
    },
  }, async (args): Promise<CallToolResult> => {
    if (!has('tasks:write')) return insufficientScope('tasks:write')
    const claim = await claimMcpMutation({ actor, tool: 'update_task', action: 'update', resourceType: 'task', idempotencyKey: args.idempotencyKey })
    if (claim.duplicate) return ok(JSON.stringify({ duplicate: true, taskId: claim.audit.resourceId, status: claim.audit.resultStatus }))
    const task = await prisma.task.findFirst({ where: { id: args.id, userId }, select: { id: true } })
    if (!task) {
      await finishMcpAudit(claim.audit.id, { summary: 'Task not found', failed: true, safeErrorCode: 'task_not_found' })
      return { isError: true, content: [{ type: 'text', text: 'Task not found.' }] }
    }
    const updates = args.updates
    const updated = await prisma.task.update({ where: { id: task.id }, data: {
      ...(updates.title !== undefined ? { title: updates.title.trim() } : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.priority !== undefined ? { priority: updates.priority === 3 ? 'high' : updates.priority === 2 ? 'medium' : 'low' } : {}),
      ...(updates.dueDate !== undefined ? { dueDate: updates.dueDate } : {}),
    } })
    await finishMcpAudit(claim.audit.id, { resourceId: updated.id, summary: 'Task updated' })
    void runAmbientTwinForUser(userId, { trigger: 'agent_outcome' }).catch(() => undefined)
    return ok(JSON.stringify({ taskId: updated.id, status: updated.status }))
  })

  server.registerTool('update_checklist_item', {
    title: 'Actualizar elemento del checklist',
    description: 'Actualiza un elemento manual o sincronizado del checklist que pertenezca al usuario autorizado. Acepta el id devuelto por get_pending_tasks.',
    inputSchema: {
      id: z.string().min(1),
      updates: z.object({
        completed: z.boolean().optional(),
        priority: z.number().int().min(1).max(3).optional(),
        dueDate: z.string().datetime({ offset: true }).nullable().optional(),
      }).refine((updates) => Object.values(updates).some((value) => value !== undefined), {
        message: 'At least one checklist update is required.',
      }),
      idempotencyKey: z.string().uuid(),
    },
  }, async (args): Promise<CallToolResult> => {
    if (!has('tasks:write')) return insufficientScope('tasks:write')
    const claim = await claimMcpMutation({ actor, tool: 'update_checklist_item', action: 'update', resourceType: 'checklist_item', idempotencyKey: args.idempotencyKey })
    if (claim.duplicate) return ok(JSON.stringify({ duplicate: true, checklistItemId: claim.audit.resourceId, status: claim.audit.resultStatus }))

    const checklistItemId = args.id.startsWith('checklist:') ? args.id.slice('checklist:'.length) : args.id
    const checklistItem = await prisma.checklistItem.findFirst({ where: { id: checklistItemId, userId }, select: { id: true } })
    if (!checklistItem) {
      await finishMcpAudit(claim.audit.id, { summary: 'Checklist item not found', failed: true, safeErrorCode: 'checklist_item_not_found' })
      return { isError: true, content: [{ type: 'text', text: 'Checklist item not found.' }] }
    }

    const updates = args.updates
    const updated = await prisma.checklistItem.update({
      where: { id: checklistItem.id },
      data: {
        ...(updates.completed !== undefined ? { completed: updates.completed } : {}),
        ...(updates.priority !== undefined ? { priority: updates.priority === 3 ? 'high' : updates.priority === 2 ? 'medium' : 'low' } : {}),
        ...(updates.dueDate !== undefined ? { dueDate: updates.dueDate ? new Date(updates.dueDate) : null } : {}),
      },
    })
    await finishMcpAudit(claim.audit.id, { resourceId: updated.id, summary: 'Checklist item updated' })
    void runAmbientTwinForUser(userId, { trigger: 'agent_outcome' }).catch(() => undefined)
    return ok(JSON.stringify({ checklistItemId: updated.id, completed: updated.completed, priority: updated.priority, dueDate: updated.dueDate }))
  })

  // ── CALENDAR ──────────────────────────────────────────────────────────────

  // ── ROUTINES ──────────────────────────────────────────────────────────────

  server.registerTool('read_routines', {
    title: 'Leer rutinas',
    description: 'Devuelve las rutinas activas del usuario.',
    inputSchema: { activeOnly: z.boolean().optional().default(true) },
  }, async (args): Promise<CallToolResult> => {
    if (!has('routines:read')) return insufficientScope('routines:read')
    const routines = await prisma.routine.findMany({
      where: { userId, ...(args.activeOnly ? { isActive: true } : {}) },
      include: { days: true, tasks: true },
      take: 20,
    })
    await auditMcpRead({ actor, tool: 'read_routines', action: 'read', resourceType: 'routine', summary: `${routines.length} routines read` })
    return ok(JSON.stringify(routines))
  })

  // ── COGNITIVE TWIN ────────────────────────────────────────────────────────

  // ── INTEGRATIONS ──────────────────────────────────────────────────────────

  server.registerTool('read_integration_data', {
    title: 'Leer datos de integraciones',
    description: 'Devuelve datos sincronizados de plugins activos.',
    inputSchema: {
      provider: z.enum(['notion', 'todoist', 'slack', 'gcal', 'github', 'all']).default('all'),
    },
  }, async (args): Promise<CallToolResult> => {
    if (!has('integrations:read')) return insufficientScope('integrations:read')
    const accounts = await prisma.integrationAccount.findMany({ where: { userId }, select: { provider: true, createdAt: true } })
    const checklist = await prisma.checklistItem.findMany({
      where: { userId, completed: false, ...(args.provider !== 'all' ? { source: args.provider } : { source: { in: ['notion', 'todoist'] } }) },
      take: 30,
      orderBy: { dueDate: 'asc' },
    })
    await auditMcpRead({ actor, tool: 'read_integration_data', action: 'read', resourceType: 'integration_data', summary: `${checklist.length} pending integration items read` })
    return ok(JSON.stringify({ connectedProviders: accounts.map((a) => a.provider), pendingItems: checklist }))
  })

  server.registerTool('trigger_plugin_sync', {
    title: 'Sincronizar plugin',
    description: 'Fuerza la re-sincronización de un plugin.',
    inputSchema: { provider: z.enum(['notion', 'todoist', 'slack', 'gcal', 'github', 'all']), idempotencyKey: z.string().uuid() },
  }, async (args): Promise<CallToolResult> => {
    if (!has('integrations:write')) return insufficientScope('integrations:write')
    const claim = await claimMcpMutation({ actor, tool: 'trigger_plugin_sync', action: 'sync', resourceType: 'integration', idempotencyKey: args.idempotencyKey })
    if (claim.duplicate) return ok(JSON.stringify({ duplicate: true, status: claim.audit.resultStatus }))
    try {
      if (args.provider === 'all') {
        const { results, totalSignals } = await syncAllPlugins(userId)
        await finishMcpAudit(claim.audit.id, { summary: `Sync completed for ${results.filter((r) => r.status === 'success').length} plugins` })
        return ok(`Sync completo: ${results.filter((r) => r.status === 'success').length} plugins, ${totalSignals} señales.`)
      }
      const result = await syncPlugin(userId, args.provider as PluginProvider)
      await finishMcpAudit(claim.audit.id, { summary: `Sync completed for ${args.provider}` })
      return ok(`${args.provider}: ${result.status}. Señales: ${result.signalsEmitted}.${result.error ? ` Error: ${result.error}` : ''}`)
    } catch {
      await finishMcpAudit(claim.audit.id, { summary: 'Plugin sync failed', failed: true, safeErrorCode: 'plugin_sync_failed' })
      return { isError: true, content: [{ type: 'text', text: 'Plugin sync could not be completed.' }] }
    }
  })

  // ── RESOURCES ─────────────────────────────────────────────────────────────

  server.registerResource('cognitive-twin', 'novo://cognitive-twin',
    { description: 'Estado completo del Cognitive Twin.', mimeType: 'application/json' },
    async (uri): Promise<ReadResourceResult> => {
      if (!has('twin:read')) return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(insufficientScope('twin:read')) }] }
      const record = await prisma.cognitiveTwinRecord.findUnique({ where: { userId } })
      await auditMcpRead({ actor, tool: 'read_resource:cognitive-twin', action: 'read', resourceType: 'cognitive_twin', summary: record ? 'Cognitive twin resource read' : 'Uninitialized cognitive twin resource read' })
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(record ?? { isInitialized: false }) }] }
    }
  )

  server.registerResource('tasks-today', 'novo://tasks/today',
    { description: 'Tareas para hoy (vencen hoy, vencidas, o sin fecha).', mimeType: 'application/json' },
    async (uri): Promise<ReadResourceResult> => {
      if (!has('tasks:read')) return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(insufficientScope('tasks:read')) }] }
      const now = new Date()
      const tasks = await prisma.task.findMany({ where: { userId, status: { not: 'done' } }, orderBy: { createdAt: 'desc' } })
      const todays = tasks.filter((t) => {
        if (!t.dueDate) return true
        const d = new Date(t.dueDate)
        return Number.isNaN(d.getTime()) || isSameDay(d, now) || d.getTime() < now.getTime()
      })
      await auditMcpRead({ actor, tool: 'read_resource:tasks-today', action: 'read', resourceType: 'task', summary: `${todays.length} today task resources read` })
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(todays) }] }
    }
  )

  server.registerResource('integrations-status', 'novo://integrations/status',
    { description: 'Estado de conexión de cada plugin.', mimeType: 'application/json' },
    async (uri): Promise<ReadResourceResult> => {
      if (!has('integrations:read')) return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(insufficientScope('integrations:read')) }] }
      const accounts = await prisma.integrationAccount.findMany({ where: { userId }, select: { provider: true, createdAt: true } })
      const googleAcc = await prisma.account.findFirst({ where: { userId, provider: 'google' }, select: { provider: true } })
      const connected = [...accounts.map((a) => ({ provider: a.provider, connectedAt: a.createdAt })), ...(googleAcc ? [{ provider: 'gcal', connectedAt: null }] : [])]
      await auditMcpRead({ actor, tool: 'read_resource:integrations-status', action: 'read', resourceType: 'integration', summary: `${connected.length} integration statuses read` })
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ connected }) }] }
    }
  )

  server.registerResource('agent-logs', 'novo://agent/logs',
    { description: 'Últimas 20 acciones del Twin Agent.', mimeType: 'application/json' },
    async (uri): Promise<ReadResourceResult> => {
      if (!has('agent:execute') && !has('twin:read')) return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(insufficientScope('twin:read')) }] }
      const logs = await prisma.twinAgentLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 })
      await auditMcpRead({ actor, tool: 'read_resource:agent-logs', action: 'read', resourceType: 'agent_log', summary: `${logs.length} agent logs read` })
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(logs) }] }
    }
  )

  return server
}

async function handle(req: Request): Promise<Response> {
  const prepared = await prepareMcpRequest(req)
  if (!prepared.ok) return prepared.response
  const request = prepared.request
  const auth = await validateMcpBearerToken(request)
  if (!auth.ok) {
    await recordMcpSecurityEvent({
      eventType: 'authorization_rejected',
      clientId: request.headers.get('mcp-client-id') ?? undefined,
      reason: auth.error,
    })
    return new Response(
      JSON.stringify({ error: auth.error, error_description: auth.description }),
      {
        status: auth.status,
        headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': wwwAuthenticateHeader(auth.error, auth.description) },
      }
    )
  }
  const clientId = auth.authInfo.clientId || 'oauth-client'
  const tokenId = clientId.startsWith('novo-device:') ? clientId.slice('novo-device:'.length) : undefined
  const perToken = rateLimit(`mcp:client:${clientId}`, 60, 60_000)
  const perUser = rateLimit(`mcp:user:${auth.userId}`, 120, 60_000)
  if (!perToken.allowed || !perUser.allowed) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(Math.max(perToken.resetIn, perUser.resetIn) / 1000)) } })
  }
  const server = buildServer(auth.userId, auth.authInfo.scopes, { userId: auth.userId, clientId, tokenId })
  const transport = new WebStandardStreamableHTTPServerTransport()
  await server.connect(transport)
  return transport.handleRequest(request, { authInfo: auth.authInfo })
}

export const GET = handle
export const POST = handle
export const DELETE = handle
