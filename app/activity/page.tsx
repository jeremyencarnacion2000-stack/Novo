import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NovoActivitySurface } from '@/components/ai/novo-activity-surface'

export const dynamic = 'force-dynamic'

/**
 * Stable deep link for operational runs. The surface intentionally shows only
 * the latest owner-scoped run; detailed payloads remain behind the run API.
 */
export default async function ActivityPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center px-6 py-16">
        <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.03] p-8 text-center">
          <p className="text-sm text-muted-foreground">Inicia sesión para consultar la actividad de Novo.</p>
          <a className="mt-4 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground" href="/auth/signin?callbackUrl=%2Factivity">Entrar</a>
        </div>
      </main>
    )
  }

  const { prisma } = await import('@/lib/prisma')
  const run = await prisma.aiActivityRun.findFirst({
    where: { userId: session.user.id, surface: 'novo_loop' },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, status: true, phase: true, sequence: true },
  })

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8 md:py-12">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Novo Loop</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Actividad operativa</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">Consulta el estado verificable de tu última ejecución y recupera el contexto si la conexión se interrumpió.</p>
      </header>
      {run ? <NovoActivitySurface runId={run.id} /> : <div className="rounded-3xl border border-dashed border-foreground/15 bg-foreground/[0.02] p-8 text-sm text-muted-foreground">Aún no hay ejecuciones del Novo Loop.</div>}
    </main>
  )
}
