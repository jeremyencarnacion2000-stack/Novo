import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { ConnectorsClient } from '@/components/connectors/connectors-client'

export const dynamic = 'force-dynamic'

export default async function ConnectorsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  return <ConnectorsClient />
}
