// Scopes offered by the Novo MCP OAuth server. Each maps to a specific,
// narrow capability boundary in the executor / MCP tool layer — never one
// catch-all "everything" scope. Keep this list in sync with the tool/resource
// scope checks in app/api/mcp/route.ts.
export const MCP_SCOPE_DESCRIPTIONS: Record<string, string> = {
  'tasks:read':         'Leer tus tareas',
  'tasks:write':        'Crear y modificar tareas',
  'calendar:write':     'Crear eventos en tu calendario',
  'twin:read':          'Leer tu estado cognitivo actual',
  'twin:write':         'Actualizar métricas del Cognitive Twin',
  'dayplan:execute':    'Generar y ejecutar un plan de día',
  'routines:read':      'Leer tus rutinas',
  'routines:write':     'Crear y modificar rutinas',
  'integrations:read':  'Leer datos sincronizados de tus integraciones',
  'integrations:write': 'Forzar re-sincronización de plugins',
  'agent:execute':      'Ejecutar el Twin Agent autónomo',
}

export const MCP_SCOPES = Object.keys(MCP_SCOPE_DESCRIPTIONS)

export function isKnownScope(scope: string): boolean {
  return Object.prototype.hasOwnProperty.call(MCP_SCOPE_DESCRIPTIONS, scope)
}
