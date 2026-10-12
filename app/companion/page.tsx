import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CompanionMobileContext } from '@/components/companion/companion-mobile-context'

export const dynamic = 'force-dynamic'

export default async function CompanionPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center px-6 py-16">
        <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.03] p-8 text-center">
          <p className="text-sm text-muted-foreground">Inicia sesión para consultar el contexto de tu compañero.</p>
          <a className="mt-4 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground" href="/auth/signin?callbackUrl=%2Fcompanion">Entrar</a>
        </div>
      </main>
    )
  }

  return <CompanionMobileContext />
}
