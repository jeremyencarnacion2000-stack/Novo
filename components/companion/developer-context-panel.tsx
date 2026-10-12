'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Github, RefreshCw, ShieldCheck, Upload, X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

type Project = { id: string; name: string; selected?: boolean }
type VercelConnection = { connected: boolean; projects: Project[]; selectedProjectIds: string[] }
type GithubRepo = {
  repository: string
  openPullRequests: number
  requestedReviewers: number
  latestReviewState: string
  ci: { passed: number; failed: number; pending: number }
}
type Deployment = { id: string; projectId: string; projectName: string; state: string; createdAt: string; url: string | null }
type DeveloperContext = {
  github: { connected: boolean; sourceExcluded: boolean; repositories: GithubRepo[]; error?: string }
  vercel: { connected: boolean; sourceExcluded: boolean; projects: Project[]; deployments: Deployment[]; error?: string }
}
type Locale = 'es' | 'en' | 'fr' | 'de'

const COPY: Record<Locale, Record<string, string>> = {
  es: {
    title: 'Fuentes de desarrollo', description: 'Consulta resúmenes de GitHub y despliegues Vercel. No se descargan diffs, mensajes de commits ni títulos de PR.',
    loading: 'Cargando fuentes autorizadas…', refresh: 'Actualizar contexto', github: 'GitHub', vercel: 'Vercel', connectGithub: 'Conectar GitHub',
    notConnected: 'No hay una conexión disponible para esta cuenta.', excluded: 'Fuente excluida: Novo no la consulta ni la muestra.', noRepos: 'No hay repositorios recientes disponibles.', noDeployments: 'Selecciona proyectos para ver su estado de despliegue.',
    excludeSource: 'Excluir fuente', restoreSource: 'Restaurar fuente',
    prs: 'PR abiertos', requested: 'revisiones solicitadas', review: 'última revisión', checks: 'CI', passed: 'correctos', failed: 'fallidos', pending: 'pendientes',
    connectHeading: 'Conecta tu cuenta', token: 'Token personal de Vercel', team: 'ID de equipo (opcional)', connectVercel: 'Conectar Vercel', disconnect: 'Desconectar',
    selectProjects: 'Proyectos que Novo puede consultar', saveSelection: 'Guardar selección', saving: 'Guardando…', selected: 'seleccionado',
    preview: 'Previsualizar contexto', privacy: 'La vista previa solo contiene nombres de repositorios/proyectos, contadores de PR, estado resumido de revisión/CI y estado de despliegue.',
    previewTitle: 'Vista previa para el Twin', emptyPreview: 'No hay contexto disponible de fuentes conectadas.', copy: 'Copiar contexto y pedir propuesta', copied: 'Petición copiada', proposalPrompt: 'Propón tres próximos pasos; no ejecutes cambios.', openTwin: 'Abrir el Twin', close: 'Cerrar', retry: 'Intentar de nuevo',
    authRequired: 'La conexión necesita autorización de nuevo.', permission: 'El token no tiene permiso de lectura suficiente.', rateLimit: 'El proveedor limitó las consultas temporalmente.', unavailable: 'La fuente no está disponible ahora.', requestFailed: 'No se pudo completar la solicitud.',
    reviewApproved: 'aprobada', reviewChanges: 'cambios solicitados', reviewCommented: 'comentarios', reviewPending: 'pendiente', reviewNone: 'sin actividad reciente',
    sourceReadOnly: 'Lectura únicamente; el Companion no fusiona cambios ni despliega.',
  },
  en: {
    title: 'Development sources', description: 'Review GitHub summaries and Vercel deployments. Diffs, commit messages, and PR titles are not fetched.',
    loading: 'Loading authorised sources…', refresh: 'Refresh context', github: 'GitHub', vercel: 'Vercel', connectGithub: 'Connect GitHub',
    notConnected: 'No connection is available for this account.', excluded: 'Source excluded: Novo will not query or display it.', noRepos: 'No recent repositories are available.', noDeployments: 'Select projects to view deployment status.',
    excludeSource: 'Exclude source', restoreSource: 'Restore source',
    prs: 'Open PRs', requested: 'review requests', review: 'latest review', checks: 'CI', passed: 'passed', failed: 'failed', pending: 'pending',
    connectHeading: 'Connect your account', token: 'Vercel personal token', team: 'Team ID (optional)', connectVercel: 'Connect Vercel', disconnect: 'Disconnect',
    selectProjects: 'Projects Novo can read', saveSelection: 'Save selection', saving: 'Saving…', selected: 'selected',
    preview: 'Preview context', privacy: 'The preview contains only repository/project names, PR counts, review/CI status counts, and deployment state.',
    previewTitle: 'Twin context preview', emptyPreview: 'No context is available from connected sources.', copy: 'Copy context and request a proposal', copied: 'Request copied', proposalPrompt: 'Suggest three next steps; do not execute changes.', openTwin: 'Open the Twin', close: 'Close', retry: 'Try again',
    authRequired: 'The connection needs authorisation again.', permission: 'The token does not have sufficient read permission.', rateLimit: 'The provider temporarily limited requests.', unavailable: 'The source is unavailable right now.', requestFailed: 'The request could not be completed.',
    reviewApproved: 'approved', reviewChanges: 'changes requested', reviewCommented: 'commented', reviewPending: 'pending', reviewNone: 'no recent review',
    sourceReadOnly: 'Read-only; the Companion does not merge changes or deploy.',
  },
  fr: {
    title: 'Sources de développement', description: 'Consultez les résumés GitHub et les déploiements Vercel. Aucun diff, message de commit ou titre de PR n’est récupéré.',
    loading: 'Chargement des sources autorisées…', refresh: 'Actualiser le contexte', github: 'GitHub', vercel: 'Vercel', connectGithub: 'Connecter GitHub',
    notConnected: 'Aucune connexion n’est disponible pour ce compte.', excluded: 'Source exclue : Novo ne la consulte ni ne l’affiche.', noRepos: 'Aucun dépôt récent disponible.', noDeployments: 'Sélectionnez des projets pour voir leur état de déploiement.',
    excludeSource: 'Exclure la source', restoreSource: 'Restaurer la source',
    prs: 'PR ouvertes', requested: 'demandes de revue', review: 'dernière revue', checks: 'CI', passed: 'réussies', failed: 'échouées', pending: 'en attente',
    connectHeading: 'Connectez votre compte', token: 'Jeton personnel Vercel', team: 'ID d’équipe (facultatif)', connectVercel: 'Connecter Vercel', disconnect: 'Déconnecter',
    selectProjects: 'Projets que Novo peut consulter', saveSelection: 'Enregistrer la sélection', saving: 'Enregistrement…', selected: 'sélectionné',
    preview: 'Prévisualiser le contexte', privacy: 'L’aperçu contient uniquement les noms, les compteurs de PR, l’état résumé des revues/CI et l’état des déploiements.',
    previewTitle: 'Aperçu du contexte du Jumeau', emptyPreview: 'Aucun contexte de source connectée disponible.', copy: 'Copier le contexte et demander une proposition', copied: 'Demande copiée', proposalPrompt: 'Propose trois prochaines étapes ; n’exécute aucun changement.', openTwin: 'Ouvrir le Jumeau', close: 'Fermer', retry: 'Réessayer',
    authRequired: 'La connexion doit être autorisée à nouveau.', permission: 'Le jeton ne dispose pas des permissions de lecture suffisantes.', rateLimit: 'Le fournisseur limite temporairement les requêtes.', unavailable: 'La source est indisponible pour le moment.', requestFailed: 'La requête n’a pas abouti.',
    reviewApproved: 'approuvée', reviewChanges: 'changements demandés', reviewCommented: 'commentée', reviewPending: 'en attente', reviewNone: 'aucune revue récente',
    sourceReadOnly: 'Lecture seule ; le Compagnon ne fusionne ni ne redéploie.',
  },
  de: {
    title: 'Entwicklungsquellen', description: 'GitHub-Zusammenfassungen und Vercel-Deployments ansehen. Diffs, Commit-Nachrichten und PR-Titel werden nicht abgerufen.',
    loading: 'Autorisierte Quellen werden geladen…', refresh: 'Kontext aktualisieren', github: 'GitHub', vercel: 'Vercel', connectGithub: 'GitHub verbinden',
    notConnected: 'Für dieses Konto ist keine Verbindung verfügbar.', excluded: 'Quelle ausgeschlossen: Novo fragt sie nicht ab und zeigt sie nicht an.', noRepos: 'Keine aktuellen Repositories verfügbar.', noDeployments: 'Projekte auswählen, um den Deployment-Status zu sehen.',
    excludeSource: 'Quelle ausschließen', restoreSource: 'Quelle wiederherstellen',
    prs: 'Offene PRs', requested: 'Review-Anfragen', review: 'letztes Review', checks: 'CI', passed: 'erfolgreich', failed: 'fehlgeschlagen', pending: 'ausstehend',
    connectHeading: 'Konto verbinden', token: 'Persönlicher Vercel-Token', team: 'Team-ID (optional)', connectVercel: 'Vercel verbinden', disconnect: 'Trennen',
    selectProjects: 'Projekte, die Novo lesen darf', saveSelection: 'Auswahl speichern', saving: 'Speichern…', selected: 'ausgewählt',
    preview: 'Kontextvorschau', privacy: 'Die Vorschau enthält nur Repository-/Projektnamen, PR-Zahlen, Review-/CI-Status und Deployment-Status.',
    previewTitle: 'Twin-Kontextvorschau', emptyPreview: 'Kein Kontext verbundener Quellen verfügbar.', copy: 'Kontext kopieren und Vorschlag anfordern', copied: 'Anfrage kopiert', proposalPrompt: 'Schlage drei nächste Schritte vor; führe keine Änderungen aus.', openTwin: 'Twin öffnen', close: 'Schließen', retry: 'Erneut versuchen',
    authRequired: 'Die Verbindung muss erneut autorisiert werden.', permission: 'Der Token hat nicht genügend Leseberechtigungen.', rateLimit: 'Der Anbieter begrenzt Anfragen vorübergehend.', unavailable: 'Die Quelle ist derzeit nicht verfügbar.', requestFailed: 'Die Anfrage konnte nicht abgeschlossen werden.',
    reviewApproved: 'genehmigt', reviewChanges: 'Änderungen angefordert', reviewCommented: 'kommentiert', reviewPending: 'ausstehend', reviewNone: 'keine aktuelle Review',
    sourceReadOnly: 'Nur lesend; der Companion führt keine Merges oder Deployments aus.',
  },
}

function safeProviderError(value: string | undefined, copy: Record<string, string>) {
  if (value === 'provider_auth_required' || value === 'reauthorization_required') return copy.authRequired
  if (value === 'provider_permission_denied') return copy.permission
  if (value === 'provider_rate_limited') return copy.rateLimit
  if (value === 'provider_unavailable') return copy.unavailable
  return copy.requestFailed
}

export function DeveloperContextPanel() {
  const { language } = useTranslation()
  const locale: Locale = language === 'es' || language === 'fr' || language === 'de' ? language : 'en'
  const copy = COPY[locale]
  const [connection, setConnection] = useState<VercelConnection | null>(null)
  const [context, setContext] = useState<DeveloperContext | null>(null)
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const [connectionResponse, contextResponse] = await Promise.all([
        fetch('/api/integration/vercel', { cache: 'no-store', signal }),
        fetch('/api/companion/developer-context', { cache: 'no-store', signal }),
      ])
      if (!connectionResponse.ok || !contextResponse.ok) throw new Error('request_failed')
      const [connectionPayload, contextPayload] = await Promise.all([connectionResponse.json(), contextResponse.json()]) as [VercelConnection, DeveloperContext]
      if (!Array.isArray(connectionPayload.projects) || !contextPayload.github || !contextPayload.vercel) throw new Error('invalid_response')
      setConnection(connectionPayload)
      setSelectedProjectIds(connectionPayload.selectedProjectIds ?? [])
      setContext(contextPayload)
    } catch {
      if (!signal?.aborted) setError(copy.requestFailed)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [copy.requestFailed])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const preview = useMemo(() => {
    const lines: string[] = []
    for (const repository of context?.github.repositories ?? []) {
      lines.push(`GitHub ${repository.repository}: ${repository.openPullRequests} PR abiertos, ${repository.requestedReviewers} revisiones solicitadas, última revisión ${repository.latestReviewState}; CI ${repository.ci.passed} correctos, ${repository.ci.failed} fallidos, ${repository.ci.pending} pendientes.`)
    }
    for (const deployment of context?.vercel.deployments ?? []) {
      lines.push(`Vercel ${deployment.projectName}: despliegue ${deployment.state}.`)
    }
    return lines.join('\n')
  }, [context])

  async function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const accessToken = String(data.get('accessToken') ?? '')
    const teamId = String(data.get('teamId') ?? '').trim()
    const tokenField = form.elements.namedItem('accessToken')
    if (tokenField instanceof HTMLInputElement) tokenField.value = ''
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/integration/vercel', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accessToken, ...(teamId ? { teamId } : {}) }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(safeProviderError(body.error, copy))
      const selected: VercelConnection = { connected: true, projects: body.projects.map((project: Project) => ({ ...project, selected: false })), selectedProjectIds: body.selectedProjectIds ?? [] }
      setConnection(selected)
      setSelectedProjectIds(selected.selectedProjectIds)
    } catch (error) {
      setError(error instanceof Error && Object.values(copy).includes(error.message) ? error.message : copy.requestFailed)
    } finally {
      setBusy(false)
    }
  }

  async function saveSelection() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/integration/vercel', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ selectedProjectIds }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(safeProviderError(body.error, copy))
      setConnection((current) => current ? { ...current, selectedProjectIds: body.selectedProjectIds, projects: current.projects.map((project) => ({ ...project, selected: body.selectedProjectIds.includes(project.id) })) } : current)
      const responseContext = await fetch('/api/companion/developer-context', { cache: 'no-store' })
      if (responseContext.ok) setContext(await responseContext.json())
    } catch (error) {
      setError(error instanceof Error && Object.values(copy).includes(error.message) ? error.message : copy.requestFailed)
    } finally {
      setBusy(false)
    }
  }

  async function disconnectVercel() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/integration/vercel', { method: 'DELETE' })
      if (!response.ok) throw new Error('request_failed')
      setConnection({ connected: false, projects: [], selectedProjectIds: [] })
      setSelectedProjectIds([])
      setContext((current) => current ? { ...current, vercel: { connected: false, sourceExcluded: false, projects: [], deployments: [] } } : current)
    } catch {
      setError(copy.requestFailed)
    } finally {
      setBusy(false)
    }
  }

  async function toggleSource(source: 'github' | 'vercel') {
    const entry = context?.[source]
    if (!entry?.connected) return
    const excluded = entry.sourceExcluded
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/cognitive/loop/signals', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: excluded ? 'restore_source' : 'exclude_source', source, reason: 'companion_source_control' }),
      })
      if (!response.ok) throw new Error('source_preference_unavailable')
      setContext((current) => {
        if (!current) return current
        if (source === 'github') return { ...current, github: { ...current.github, sourceExcluded: !excluded, repositories: excluded ? current.github.repositories : [] } }
        return { ...current, vercel: { ...current.vercel, sourceExcluded: !excluded, deployments: excluded ? current.vercel.deployments : [] } }
      })
      if (excluded) await load()
    } catch {
      setError(copy.requestFailed)
    } finally {
      setBusy(false)
    }
  }

  async function copyPreview() {
    if (!preview) return
    try {
      await navigator.clipboard.writeText(`${copy.proposalPrompt}\n\n${preview}`)
      setCopied(true)
    } catch {
      setError(copy.requestFailed)
    }
  }

  const reviewText = (state: string) => ({
    approved: copy.reviewApproved, changes_requested: copy.reviewChanges, commented: copy.reviewCommented,
    pending: copy.reviewPending, none: copy.reviewNone,
  }[state] ?? copy.reviewNone)

  return (
    <section aria-labelledby="companion-developer-title" className="mt-5 rounded-[26px] border border-foreground/[0.08] bg-foreground/[0.02] p-5 md:p-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/75">{copy.title}</p><h2 id="companion-developer-title" className="mt-1 text-base font-semibold text-foreground">{copy.title}</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-foreground/45">{copy.description}</p></div>
        <button type="button" disabled={loading || busy} onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/10 px-3 text-xs font-semibold text-foreground/65 hover:bg-foreground/[0.05] disabled:opacity-50"><RefreshCw className="size-3.5" />{copy.refresh}</button>
      </header>

      {error && <p role="alert" className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs text-amber-200">{error}</p>}
      {loading ? <p role="status" className="mt-5 text-sm text-foreground/45">{copy.loading}</p> : <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-foreground/[0.07] bg-background/20 p-4">
          <div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-semibold text-foreground/80"><Github className="size-4" />{copy.github}</h3>{context?.github.connected && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/[0.08] px-2 py-1 text-[10px] text-emerald-400"><ShieldCheck className="size-3" />{copy.sourceReadOnly}</span>}</div>
          {!context?.github.connected ? <div className="mt-4"><p className="text-xs text-foreground/45">{copy.notConnected}</p><a href="/api/integration/github/connect" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/10 px-4 text-xs font-semibold text-foreground/70 hover:bg-foreground/[0.05]"><Github className="size-3.5" />{copy.connectGithub}</a></div>
            : context.github.sourceExcluded ? <div className="mt-4"><p className="text-xs leading-5 text-foreground/45">{copy.excluded}</p><button type="button" onClick={() => void toggleSource('github')} disabled={busy} className="mt-3 min-h-9 rounded-full border border-foreground/10 px-3 text-[11px] text-foreground/55 disabled:opacity-50">{copy.restoreSource} {copy.github}</button></div>
              : <div className="mt-3">
                {context.github.error ? <p className="text-xs leading-5 text-amber-200">{safeProviderError(context.github.error, copy)}</p>
                  : context.github.repositories.length === 0 ? <p className="text-xs text-foreground/45">{copy.noRepos}</p>
                    : <ul className="divide-y divide-foreground/[0.06]">{context.github.repositories.map((repo) => <li key={repo.repository} className="py-3 first:pt-0 last:pb-0"><p className="text-xs font-semibold text-foreground/75">{repo.repository}</p><p className="mt-1 text-[11px] leading-5 text-foreground/45">{repo.openPullRequests} {copy.prs} · {repo.requestedReviewers} {copy.requested} · {copy.review}: {reviewText(repo.latestReviewState)}<br />{copy.checks}: {repo.ci.passed} {copy.passed}, {repo.ci.failed} {copy.failed}, {repo.ci.pending} {copy.pending}</p></li>)}</ul>}
                <button type="button" onClick={() => void toggleSource('github')} disabled={busy} className="mt-3 min-h-9 rounded-full border border-foreground/10 px-3 text-[11px] text-foreground/55 disabled:opacity-50">{copy.excludeSource} {copy.github}</button>
              </div>}
        </article>

        <article className="rounded-2xl border border-foreground/[0.07] bg-background/20 p-4">
          <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-foreground/80">{copy.vercel}</h3>{context?.vercel.connected && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/[0.08] px-2 py-1 text-[10px] text-emerald-400"><ShieldCheck className="size-3" />{copy.sourceReadOnly}</span>}</div>
          {!connection?.connected ? <form onSubmit={handleConnect} className="mt-4 grid gap-3">
            <p className="text-xs text-foreground/45">{copy.connectHeading}</p>
            <label className="grid gap-1.5 text-[11px] text-foreground/55">{copy.token}<input name="accessToken" type="password" autoComplete="new-password" required maxLength={2048} className="min-h-10 rounded-xl border border-foreground/10 bg-background/40 px-3 text-xs text-foreground outline-none focus:border-primary/40" /></label>
            <label className="grid gap-1.5 text-[11px] text-foreground/55">{copy.team}<input name="teamId" autoComplete="off" maxLength={128} className="min-h-10 rounded-xl border border-foreground/10 bg-background/40 px-3 text-xs text-foreground outline-none focus:border-primary/40" /></label>
            <button type="submit" disabled={busy} className="min-h-10 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50">{busy ? copy.saving : copy.connectVercel}</button>
          </form> : context?.vercel.sourceExcluded ? <div className="mt-4"><p className="text-xs leading-5 text-foreground/45">{copy.excluded}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void toggleSource('vercel')} disabled={busy} className="min-h-9 rounded-full border border-foreground/10 px-3 text-[11px] text-foreground/55 disabled:opacity-50">{copy.restoreSource} {copy.vercel}</button><button type="button" onClick={() => void disconnectVercel()} disabled={busy} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-foreground/10 px-3 text-[11px] text-foreground/55 disabled:opacity-50"><X className="size-3" />{copy.disconnect}</button></div></div>
            : <>
              <p className="mt-4 text-xs font-medium text-foreground/65">{copy.selectProjects}</p>
              <div className="mt-2 max-h-40 space-y-1 overflow-auto">{connection.projects.map((project) => <label key={project.id} className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs text-foreground/65 hover:bg-foreground/[0.035]"><input type="checkbox" checked={selectedProjectIds.includes(project.id)} onChange={(event) => setSelectedProjectIds((current) => event.target.checked ? [...current, project.id].slice(0, 10) : current.filter((id) => id !== project.id))} />{project.name}</label>)}</div>
              <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void saveSelection()} disabled={busy || selectedProjectIds.length > 10} className="min-h-9 rounded-full bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-50">{busy ? copy.saving : copy.saveSelection}</button><button type="button" onClick={() => void toggleSource('vercel')} disabled={busy} className="min-h-9 rounded-full border border-foreground/10 px-3 text-[11px] text-foreground/55 disabled:opacity-50">{copy.excludeSource} {copy.vercel}</button><button type="button" onClick={() => void disconnectVercel()} disabled={busy} className="min-h-9 rounded-full border border-foreground/10 px-3 text-[11px] text-foreground/55 disabled:opacity-50">{copy.disconnect}</button></div>
              {context?.vercel.error && <p className="mt-3 text-xs text-amber-200">{safeProviderError(context.vercel.error, copy)}</p>}
              {context?.vercel.sourceExcluded ? <p className="mt-3 text-xs text-foreground/45">{copy.excluded}</p> : context?.vercel.deployments.length ? <ul className="mt-3 divide-y divide-foreground/[0.06]">{context.vercel.deployments.map((deployment) => <li key={deployment.id} className="flex items-center justify-between gap-3 py-2 text-xs"><span className="text-foreground/65">{deployment.projectName}</span><span className="flex items-center gap-2 font-medium text-foreground/75">{deployment.state}{deployment.url && <a href={deployment.url} target="_blank" rel="noreferrer" aria-label={`${copy.vercel} ${deployment.projectName}`} className="text-primary"><ExternalLink className="size-3.5" /></a>}</span></li>)}</ul> : <p className="mt-3 text-xs text-foreground/45">{copy.noDeployments}</p>}
            </>}
        </article>
      </div>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-foreground/[0.06] pt-4">
        <p className="text-[11px] leading-5 text-foreground/40">{copy.privacy}</p>
        <button type="button" disabled={!preview || loading} onClick={() => { setCopied(false); setPreviewOpen(true) }} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.07] px-3 text-xs font-semibold text-primary disabled:opacity-40"><Upload className="size-3.5" />{copy.preview}</button>
      </div>

      {previewOpen && <div role="dialog" aria-modal="true" aria-labelledby="developer-context-preview-title" className="fixed inset-0 z-[100] grid place-items-center bg-black/65 p-4" onKeyDown={(event) => { if (event.key === 'Escape') setPreviewOpen(false) }}>
        <div className="w-full max-w-lg rounded-3xl border border-foreground/10 bg-background p-5 shadow-2xl md:p-7">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/75">{copy.preview}</p><h3 id="developer-context-preview-title" className="mt-2 text-lg font-semibold text-foreground">{copy.previewTitle}</h3></div><button type="button" aria-label={copy.close} onClick={() => setPreviewOpen(false)} className="grid size-9 place-items-center rounded-full border border-foreground/10 text-foreground/50 hover:bg-foreground/[0.05]"><X className="size-4" /></button></div>
          <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-foreground/[0.07] bg-foreground/[0.025] p-4 text-xs leading-6 text-foreground/70">{preview || copy.emptyPreview}</p>
          <p className="mt-3 text-xs font-medium text-foreground/65">{copy.proposalPrompt}</p>
          <p className="mt-3 text-[11px] leading-5 text-foreground/40">{copy.privacy}</p>
          <div className="mt-5 flex flex-wrap gap-2"><button type="button" disabled={!preview} onClick={() => void copyPreview()} className="min-h-10 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50">{copied ? copy.copied : copy.copy}</button>{copied && <Link href="/cognitive" className="inline-flex min-h-10 items-center rounded-full border border-foreground/10 px-4 text-xs font-semibold text-foreground/70">{copy.openTwin}</Link>}<button type="button" onClick={() => setPreviewOpen(false)} className="min-h-10 rounded-full border border-foreground/10 px-4 text-xs text-foreground/55">{copy.close}</button></div>
        </div>
      </div>}
    </section>
  )
}
