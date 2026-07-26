import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js'
import { prisma } from '@/lib/prisma'
import { executeAIAction } from '@/lib/ai/executor'
import { generateAndExecuteDayPlan, type DayPlanTwinInput } from '@/lib/ai/day-plan-generator'
import { validateMcpBearerToken, wwwAuthenticateHeader } from '@/lib/mcp/auth'
import { syncPlugin, syncAllPlugins, type PluginProvider } from '@/lib/plugins/plugin-orchestrator'
import { runTwinAgent } from '@/lib/cognitive/twin-agent'
import { isSameDay } from 'date-fns'

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

function buildServer(userId: string, scopes: string[]) {
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
    },
  }, async (args): Promise<CallToolResult> => {
    if (!has('tasks:write')) return insufficientScope('tasks:write')
    const result = await executeAIAction({ type: 'CREATE_TASK', payload: args } as any, userId)
    return { isError: !result.success, content: [{ type: 'text', text: result.message || result.error || 'OK' }] }
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
    const tasks = await prisma.task.findMany({ where, orderBy: { createdAt: 'desc' }, take: args.limit })
    return ok(JSON.stringify(tasks))
  })

  server.registerTool('complete_task', {
    title: 'Completar tarea',
    description: 'Marca una tarea como completada.',
    inputSchema: { id: z.string().min(1) },
  }, async (args): Promise<CallToolResult> => {
    if (!has('tasks:write')) return insufficientScope('tasks:write')
    const task = await prisma.task.update({ where: { id: args.id, userId }, data: { status: 'done' } })
    return ok(`Tarea "${task.title}" marcada como completada.`)
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
    },
  }, async (args): Promise<CallToolResult> => {
    if (!has('tasks:write')) return insufficientScope('tasks:write')
    const result = await executeAIAction({ type: 'UPDATE_TASK', payload: args } as any, userId)
    return { isError: !result.success, content: [{ type: 'text', text: result.message || result.error || 'OK' }] }
  })

  server.registerTool('delete_task', {
    title: 'Eliminar tarea',
    description: 'Elimina una tarea. Requiere confirmed=true.',
    inputSchema: { id: z.string().min(1), confirmed: z.boolean() },
    annotations: { destructiveHint: true },
  }, async (args): Promise<CallToolResult> => {
    if (!has('tasks:write')) return insufficientScope('tasks:write')
    const result = await executeAIAction({ type: 'DELETE_TASK', payload: args } as any, userId)
    return { isError: !result.success, content: [{ type: 'text', text: result.message || result.error || 'OK' }] }
  })

  // ── CALENDAR ──────────────────────────────────────────────────────────────

  server.registerTool('create_calendar_event', {
    title: 'Crear evento de calendario',
    description: 'Crea un evento en el calendario de Novo.',
    inputSchema: {
      title: z.string().min(1),
      description: z.string().optional(),
      start: z.string().describe('ISO datetime'),
      end: z.string().describe('ISO datetime'),
      allDay: z.boolean().optional(),
    },
  }, async (args): Promise<CallToolResult> => {
    if (!has('calendar:write')) return insufficientScope('calendar:write')
    const result = await executeAIAction({ type: 'CREATE_EVENT', payload: args } as any, userId)
    return { isError: !result.success, content: [{ type: 'text', text: result.message || result.error || 'OK' }] }
  })

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
    return ok(JSON.stringify(routines))
  })

  server.registerTool('create_routine', {
    title: 'Crear rutina',
    description: 'Crea una nueva rutina de hábito, entrenamiento o workflow.',
    inputSchema: {
      name: z.string().min(1),
      description: z.string().optional(),
      timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'anytime']),
      duration: z.number().int().min(1).describe('Duración en minutos'),
      daysOfWeek: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).optional(),
      scheduledTime: z.string().optional().describe('HH:MM'),
    },
  }, async (args): Promise<CallToolResult> => {
    if (!has('routines:write')) return insufficientScope('routines:write')
    const routine = await prisma.routine.create({
      data: {
        userId,
        name: args.name,
        description: args.description ?? '',
        timeOfDay: args.timeOfDay,
        duration: args.duration,
        isActive: true,
        scheduledTime: args.scheduledTime,
        daysOfWeek: args.daysOfWeek ? JSON.stringify(args.daysOfWeek) : null,
        version: 1,
      },
    })
    return ok(`Rutina "${routine.name}" creada con ID ${routine.id}.`)
  })

  // ── COGNITIVE TWIN ────────────────────────────────────────────────────────

  server.registerTool('generate_day_plan', {
    title: 'Generar plan de día',
    description: 'Genera y ejecuta un plan de día calibrado al Cognitive Twin.',
    inputSchema: {},
  }, async (): Promise<CallToolResult> => {
    if (!has('dayplan:execute')) return insufficientScope('dayplan:execute')
    const record = await prisma.cognitiveTwinRecord.findUnique({ where: { userId } })
    const twin: DayPlanTwinInput = {
      longTermGoal: record?.longTermGoal,
      identity: (record?.identity as any) || {},
      energyCurve: (record?.energyCurve as any) || {},
      bottlenecks: (record?.bottlenecks as any) || {},
    }
    const plan = await generateAndExecuteDayPlan(userId, twin, 'manual')
    return ok(`Plan generado: ${plan.tasks.length} tareas${plan.event ? ' + 1 bloque' : ''}.\n${plan.reasoning.join('\n')}`)
  })

  server.registerTool('update_twin_metrics', {
    title: 'Actualizar métricas del Twin',
    description: 'Permite que una app externa envíe datos biométricos o de estrés.',
    inputSchema: {
      cognitiveLoad: z.number().min(0).max(100).optional(),
      burnoutIndex: z.number().min(0).max(100).optional(),
      energyLevel: z.number().min(0).max(100).optional(),
      source: z.string().describe('Nombre de la app o sensor'),
    },
  }, async (args): Promise<CallToolResult> => {
    if (!has('twin:write')) return insufficientScope('twin:write')
    const twin = await prisma.cognitiveTwinRecord.findUnique({ where: { userId } })
    if (!twin) return { isError: true, content: [{ type: 'text', text: 'Twin not initialized' }] }
    const metrics = (twin.metrics as any) ?? {}
    await prisma.cognitiveTwinRecord.update({
      where: { userId },
      data: {
        metrics: {
          ...metrics,
          ...(args.cognitiveLoad !== undefined && { currentCognitiveLoad: args.cognitiveLoad }),
          ...(args.burnoutIndex !== undefined && { burnoutIndex: args.burnoutIndex }),
          ...(args.energyLevel !== undefined && { energyLevel: args.energyLevel }),
          lastExternalUpdate: new Date().toISOString(),
          externalUpdateSource: args.source,
        },
      },
    })
    return ok(`Métricas actualizadas desde "${args.source}".`)
  })

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
    return ok(JSON.stringify({ connectedProviders: accounts.map((a) => a.provider), pendingItems: checklist }))
  })

  server.registerTool('trigger_plugin_sync', {
    title: 'Sincronizar plugin',
    description: 'Fuerza la re-sincronización de un plugin.',
    inputSchema: { provider: z.enum(['notion', 'todoist', 'slack', 'gcal', 'github', 'all']) },
  }, async (args): Promise<CallToolResult> => {
    if (!has('integrations:write')) return insufficientScope('integrations:write')
    if (args.provider === 'all') {
      const { results, totalSignals } = await syncAllPlugins(userId)
      return ok(`Sync completo: ${results.filter((r) => r.status === 'success').length} plugins, ${totalSignals} señales.`)
    }
    const result = await syncPlugin(userId, args.provider as PluginProvider)
    return ok(`${args.provider}: ${result.status}. Señales: ${result.signalsEmitted}.${result.error ? ` Error: ${result.error}` : ''}`)
  })

  server.registerTool('run_twin_agent', {
    title: 'Ejecutar Twin Agent',
    description: 'Dispara el motor de acciones autónomas (burnout alerts, focus blocks, triage, etc.).',
    inputSchema: {},
  }, async (): Promise<CallToolResult> => {
    if (!has('agent:execute')) return insufficientScope('agent:execute')
    const results = await runTwinAgent(userId)
    const acted = results.filter((r) => r.result === 'success')
    return ok(`Agente ejecutado. Acciones: ${acted.length}.\n${acted.map((r) => `• ${r.capability}: ${r.description}`).join('\n')}`)
  })

  // ── RESOURCES ─────────────────────────────────────────────────────────────

  server.registerResource('cognitive-twin', 'novo://cognitive-twin',
    { description: 'Estado completo del Cognitive Twin.', mimeType: 'application/json' },
    async (uri): Promise<ReadResourceResult> => {
      if (!has('twin:read')) return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(insufficientScope('twin:read')) }] }
      const record = await prisma.cognitiveTwinRecord.findUnique({ where: { userId } })
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
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ connected }) }] }
    }
  )

  server.registerResource('agent-logs', 'novo://agent/logs',
    { description: 'Últimas 20 acciones del Twin Agent.', mimeType: 'application/json' },
    async (uri): Promise<ReadResourceResult> => {
      if (!has('agent:execute') && !has('twin:read')) return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(insufficientScope('twin:read')) }] }
      const logs = await prisma.twinAgentLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 })
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(logs) }] }
    }
  )

  return server
}

async function handle(req: Request): Promise<Response> {
  const auth = await validateMcpBearerToken(req)
  if (!auth.ok) {
    return new Response(
      JSON.stringify({ error: auth.error, error_description: auth.description }),
      {
        status: auth.status,
        headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': wwwAuthenticateHeader(auth.error, auth.description) },
      }
    )
  }
  const server = buildServer(auth.userId, auth.authInfo.scopes)
  const transport = new WebStandardStreamableHTTPServerTransport()
  await server.connect(transport)
  return transport.handleRequest(req, { authInfo: auth.authInfo })
}

export const GET = handle
export const POST = handle
export const DELETE = handle
