import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js'
import { prisma } from '@/lib/prisma'
import { executeAIAction } from '@/lib/ai/executor'
import { generateAndExecuteDayPlan, type DayPlanTwinInput } from '@/lib/ai/day-plan-generator'
import { validateMcpBearerToken, wwwAuthenticateHeader } from '@/lib/mcp/auth'
import { isSameDay } from 'date-fns'

export const runtime = 'nodejs'

// Every tool/resource here is a thin, scope-gated wrapper over existing,
// already-tested handlers (lib/ai/executor.ts's executeAIAction registry and
// lib/ai/day-plan-generator.ts) — no action logic is reimplemented.
function insufficientScope(required: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: `insufficient_scope: this tool requires the "${required}" scope, which was not granted to this token.` }],
  }
}

function buildServer(userId: string, scopes: string[]) {
  const server = new McpServer({ name: 'novo-cognitive-os', version: '1.0.0' })
  const has = (scope: string) => scopes.includes(scope)

  server.registerTool(
    'create_task',
    {
      title: 'Crear tarea',
      description: "Crea una nueva tarea en la lista de tareas del usuario de Novo.",
      inputSchema: {
        title: z.string().min(1),
        category: z.enum(['Training', 'Study', 'Personal', 'Work']),
        priority: z.number().int().min(1).max(3).describe('1=baja, 2=media, 3=alta'),
        dueDate: z.string().optional().describe('ISO date string'),
      },
    },
    async (args): Promise<CallToolResult> => {
      if (!has('tasks:write')) return insufficientScope('tasks:write')
      const result = await executeAIAction({ type: 'CREATE_TASK', payload: args } as any, userId)
      return {
        isError: !result.success,
        content: [{ type: 'text', text: result.message || result.error || 'OK' }],
      }
    }
  )

  server.registerTool(
    'update_task',
    {
      title: 'Actualizar tarea',
      description: 'Actualiza campos de una tarea existente (título, estado, prioridad, fecha límite).',
      inputSchema: {
        id: z.string().min(1),
        updates: z.object({
          title: z.string().optional(),
          status: z.enum(['todo', 'in-progress', 'done']).optional(),
          priority: z.number().int().min(1).max(3).optional(),
          dueDate: z.string().optional(),
        }),
      },
    },
    async (args): Promise<CallToolResult> => {
      if (!has('tasks:write')) return insufficientScope('tasks:write')
      const result = await executeAIAction({ type: 'UPDATE_TASK', payload: args } as any, userId)
      return {
        isError: !result.success,
        content: [{ type: 'text', text: result.message || result.error || 'OK' }],
      }
    }
  )

  server.registerTool(
    'delete_task',
    {
      title: 'Eliminar tarea',
      description: 'Elimina una tarea. Requiere confirmed=true (acción destructiva).',
      inputSchema: {
        id: z.string().min(1),
        confirmed: z.boolean().describe('Debe ser true para confirmar la eliminación'),
      },
      annotations: { destructiveHint: true },
    },
    async (args): Promise<CallToolResult> => {
      if (!has('tasks:write')) return insufficientScope('tasks:write')
      const result = await executeAIAction({ type: 'DELETE_TASK', payload: args } as any, userId)
      return {
        isError: !result.success,
        content: [{ type: 'text', text: result.message || result.error || 'OK' }],
      }
    }
  )

  server.registerTool(
    'create_calendar_event',
    {
      title: 'Crear evento de calendario',
      description: 'Crea un evento en el calendario nativo de Novo.',
      inputSchema: {
        title: z.string().min(1),
        description: z.string().optional(),
        start: z.string().describe('ISO datetime'),
        end: z.string().describe('ISO datetime'),
        allDay: z.boolean().optional(),
      },
    },
    async (args): Promise<CallToolResult> => {
      if (!has('calendar:write')) return insufficientScope('calendar:write')
      const result = await executeAIAction({ type: 'CREATE_EVENT', payload: args } as any, userId)
      return {
        isError: !result.success,
        content: [{ type: 'text', text: result.message || result.error || 'OK' }],
      }
    }
  )

  server.registerTool(
    'generate_day_plan',
    {
      title: 'Generar plan de día',
      description:
        'Genera y ejecuta un plan de día calibrado al Cognitive Twin del usuario: crea 2-3 tareas y un bloque de calendario de foco profundo.',
      inputSchema: {},
    },
    async (): Promise<CallToolResult> => {
      if (!has('dayplan:execute')) return insufficientScope('dayplan:execute')
      const record = await prisma.cognitiveTwinRecord.findUnique({ where: { userId } })
      const twin: DayPlanTwinInput = {
        longTermGoal: record?.longTermGoal,
        identity: (record?.identity as any) || {},
        energyCurve: (record?.energyCurve as any) || {},
        bottlenecks: (record?.bottlenecks as any) || {},
      }
      const plan = await generateAndExecuteDayPlan(userId, twin, 'manual')
      return {
        content: [
          {
            type: 'text',
            text: `Plan generado: ${plan.tasks.length} tareas creadas${plan.event ? ' + 1 bloque de calendario' : ''}.\n${plan.reasoning.join('\n')}`,
          },
        ],
      }
    }
  )

  server.registerResource(
    'cognitive-twin',
    'novo://cognitive-twin',
    { description: 'Estado actual del Cognitive Twin del usuario (identidad, curva de energía, métricas, bottlenecks).', mimeType: 'application/json' },
    async (uri): Promise<ReadResourceResult> => {
      if (!has('twin:read')) {
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(insufficientScope('twin:read')) }] }
      }
      const record = await prisma.cognitiveTwinRecord.findUnique({ where: { userId } })
      return {
        contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(record ?? { isInitialized: false }) }],
      }
    }
  )

  server.registerResource(
    'tasks-today',
    'novo://tasks/today',
    { description: "Tareas del usuario para hoy (vencen hoy, están vencidas, o no tienen fecha límite).", mimeType: 'application/json' },
    async (uri): Promise<ReadResourceResult> => {
      if (!has('tasks:read')) {
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(insufficientScope('tasks:read')) }] }
      }
      const now = new Date()
      const tasks = await prisma.task.findMany({
        where: { userId, status: { not: 'done' } },
        orderBy: { createdAt: 'desc' },
      })
      const todays = tasks.filter((t) => {
        if (!t.dueDate) return true
        const d = new Date(t.dueDate)
        if (Number.isNaN(d.getTime())) return true
        return isSameDay(d, now) || d.getTime() < now.getTime()
      })
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(todays) }] }
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
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': wwwAuthenticateHeader(auth.error, auth.description),
        },
      }
    )
  }

  // Stateless mode (no sessionIdGenerator): a fresh server + transport per
  // request, matching Vercel's serverless execution model — nothing here
  // persists in memory between invocations.
  const server = buildServer(auth.userId, auth.authInfo.scopes)
  const transport = new WebStandardStreamableHTTPServerTransport()
  await server.connect(transport)
  return transport.handleRequest(req, { authInfo: auth.authInfo })
}

export const GET = handle
export const POST = handle
export const DELETE = handle
