type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

const REVIEW_LABELS: Record<string, string> = {
  approved: 'aprobada',
  changes_requested: 'cambios solicitados',
  commented: 'comentada',
  pending: 'pendiente',
  none: 'sin actividad reciente',
}

function safeProviderError(provider: string, value: unknown): string | null {
  const message = value === 'provider_auth_required' || value === 'reauthorization_required'
    ? 'vuelve a autorizar la conexión.'
    : value === 'provider_permission_denied'
      ? 'faltan permisos de lectura.'
      : value === 'provider_rate_limited'
        ? 'límite temporal del proveedor; reintenta más tarde.'
        : value === 'provider_unavailable'
          ? 'lectura no disponible ahora.'
          : null
  return message ? `${provider} · ${message}` : null
}

export function formatDeveloperContext(value: unknown): string[] {
  const context = record(value)
  const lines: string[] = []
  const github = record(context.github)
  if (github.connected === true && github.sourceExcluded !== true && Array.isArray(github.repositories)) {
    const error = safeProviderError('GitHub', github.error)
    if (error) {
      lines.push(error)
    } else {
      for (const raw of github.repositories.slice(0, 5)) {
        const repo = record(raw)
        if (typeof repo.repository !== 'string' || repo.repository.length > 200) continue
        const ci = record(repo.ci)
        const review = typeof repo.latestReviewState === 'string' ? REVIEW_LABELS[repo.latestReviewState] ?? REVIEW_LABELS.none : REVIEW_LABELS.none
        lines.push(`GitHub · ${repo.repository} · ${nonNegativeInteger(repo.openPullRequests)} PR abiertas · revisión ${review} · CI ${nonNegativeInteger(ci.passed)} correctos, ${nonNegativeInteger(ci.failed)} fallidos, ${nonNegativeInteger(ci.pending)} pendientes`)
      }
    }
  }

  const vercel = record(context.vercel)
  if (vercel.connected === true && vercel.sourceExcluded !== true && Array.isArray(vercel.deployments)) {
    const error = safeProviderError('Vercel', vercel.error)
    if (error) {
      lines.push(error)
    } else {
      for (const raw of vercel.deployments.slice(0, 10)) {
        const deployment = record(raw)
        if (typeof deployment.projectName !== 'string' || typeof deployment.state !== 'string') continue
        const state = /^[A-Z_]{1,32}$/.test(deployment.state) ? deployment.state : 'UNKNOWN'
        lines.push(`Vercel · ${deployment.projectName.slice(0, 100)} · despliegue ${state}`)
      }
    }
  }
  return lines
}

export function developerContextErrorMessage(error: unknown): string {
  if (error === 'integration_read_permission_required') return 'Crea un token revocable con el permiso «Leer integraciones».'
  if (error === 'token_or_read_permission_invalid') return 'Revisa que el token tenga permiso de lectura del Twin.'
  if (error === 'provider_rate_limited') return 'El proveedor limitó las consultas temporalmente; vuelve a intentar más tarde.'
  return 'No se pudo consultar el contexto de desarrollo.'
}
