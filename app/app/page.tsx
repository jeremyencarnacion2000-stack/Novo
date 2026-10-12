import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Stable entry point for the installed app surface.
 *
 * This route deliberately never renders the public landing page. It is the
 * small server-side resolver used by the PWA and Capacitor shell:
 * - no session: web sign-in, returning here after authentication
 * - signed-in user without a completed Twin: onboarding
 * - initialized user: the full authenticated product shell (dashboard root)
 *
 * Keeping the decision on the server avoids mounting the app briefly before
 * auth/onboarding state is known and keeps OAuth handoffs global.
 */
export default async function AppEntryPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=%2Fapp')
  }

  let hasCompletedOnboarding = false
  try {
    const twin = await prisma.cognitiveTwinRecord.findUnique({
      where: { userId: session.user.id },
      select: { onboardingCompletedAt: true },
    })
    hasCompletedOnboarding = Boolean(twin?.onboardingCompletedAt)
  } catch {
    // If the database is briefly unavailable, keep the user in the safe
    // first-run surface instead of exposing an error or falling back to the
    // public landing. Onboarding has its own retryable API states.
    hasCompletedOnboarding = false
  }

  redirect(hasCompletedOnboarding ? '/' : '/onboarding')
}
