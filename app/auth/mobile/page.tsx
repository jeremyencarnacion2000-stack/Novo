import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

// The legacy bridge placed a 30-day bearer token in a novoapp:// URL. There is
// no released native consumer for that token and Novo's normal APIs use the
// server session, so redirect to the supported PWA/web experience instead.
export default async function MobileAuthBridge() {
  const session = await getServerSession(authOptions)
  // Native shells use the app resolver only; it sends new users through
  // login/onboarding and returning users to the product surface. Never bounce
  // a mobile auth handoff through the public landing.
  redirect(session?.user ? '/app' : '/auth/signin?callbackUrl=%2Fapp')
}
