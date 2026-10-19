/**
 * Provenance that is safe to expose in the chat UI.  This intentionally names
 * the product/source and the kind of context consulted, never raw tokens,
 * private URLs, or hidden model reasoning.
 */
export type ContextSourceKind = 'novo' | 'integration';

export interface ContextSource {
  id: string;
  kind: ContextSourceKind;
  provider: string;
  label: string;
  detail: string;
}

const PROVIDERS: Record<string, Pick<ContextSource, 'provider' | 'label' | 'detail'>> = {
  notion: { provider: 'notion', label: 'Notion', detail: 'Tareas y páginas sincronizadas' },
  todoist: { provider: 'todoist', label: 'Todoist', detail: 'Tareas sincronizadas' },
  slack: { provider: 'slack', label: 'Slack', detail: 'Señales de actividad aprobadas' },
  github: { provider: 'github', label: 'GitHub', detail: 'Repositorios, revisiones y estado de integración' },
  vercel: { provider: 'vercel', label: 'Vercel', detail: 'Proyectos y despliegues consultados' },
  codex: { provider: 'codex', label: 'Codex', detail: 'Estado local observado por Companion' },
  gcal: { provider: 'gcal', label: 'Google Calendar', detail: 'Agenda y bloques de tiempo' },
  google_calendar: { provider: 'gcal', label: 'Google Calendar', detail: 'Agenda y bloques de tiempo' },
  calendar: { provider: 'gcal', label: 'Google Calendar', detail: 'Agenda y bloques de tiempo' },
  gmail: { provider: 'gmail', label: 'Gmail', detail: 'Búsqueda y lectura de mensajes e hilos bajo demanda' },
};

export function getContextSource(provider: string): ContextSource | null {
  const normalized = provider.toLowerCase().replace(/[\s-]+/g, '_');
  const source = PROVIDERS[normalized];
  return source ? { id: `source:${source.provider}`, kind: 'integration', ...source } : null;
}

export const NOVO_CONTEXT_SOURCE: ContextSource = {
  id: 'source:novo',
  kind: 'novo',
  provider: 'novo',
  label: 'Novo',
  detail: 'Tareas, foco, proyectos y preferencias de esta cuenta',
};
