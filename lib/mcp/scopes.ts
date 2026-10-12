// Scopes offered by the Novo MCP OAuth server. Each maps to a specific,
// narrow capability boundary in the executor / MCP tool layer — never one
// catch-all "everything" scope. Keep this list in sync with the tool/resource
// scope checks in app/api/mcp/route.ts.
export const MCP_SCOPE_DESCRIPTIONS: Record<string, string> = {
  'device:connect':     'Vincular este dispositivo con Novo Companion',
  'ai:chat':            'Usar el chat de IA de Novo Companion',
  'device:activity:read': 'Leer los resúmenes de actividad compartidos desde el dispositivo',
  'tasks:read':         'Leer tus tareas',
  'projects:read':      'Leer tus proyectos de Novo y relacionarlos con repositorios y despliegues',
  'tasks:write':        'Crear y modificar tareas',
  'calendar:write':     'Crear eventos en tu calendario',
  'twin:read':          'Leer tu estado cognitivo actual',
  'twin:write':         'Actualizar métricas del Cognitive Twin',
  'dayplan:execute':    'Generar y ejecutar un plan de día',
  'routines:read':      'Leer tus rutinas',
  'routines:write':     'Crear y modificar rutinas',
  'integrations:read':  'Consultar tus integraciones conectadas y sus datos sincronizados',
  'integrations:write': 'Forzar re-sincronización de plugins',
  'agent:execute':      'Ejecutar el Twin Agent autónomo',
  'device:activity:write': 'Registrar aplicaciones y duración de uso desde el escritorio; no incluye contenido, títulos, rutas ni URLs',
  'device:work-context:read': 'Leer el enfoque de trabajo que compartas con Novo Companion',
  'device:work-context:write': 'Compartir o quitar tu enfoque de trabajo desde Novo Companion',
}

export const MCP_SCOPES = Object.keys(MCP_SCOPE_DESCRIPTIONS)

export function isKnownScope(scope: string): boolean {
  return Object.prototype.hasOwnProperty.call(MCP_SCOPE_DESCRIPTIONS, scope)
}
