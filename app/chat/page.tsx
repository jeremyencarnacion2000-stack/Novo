import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import AIPage from '@/app/ai/page'

/**
 * `/chat` is the primary conversational surface inside the app. Guard it on
 * the server so a deep link with an expired session goes straight to web
 * sign-in instead of briefly mounting the product shell or public landing.
 */
export default async function ChatPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin?callbackUrl=%2Fchat')

  return <AIPage />
}
