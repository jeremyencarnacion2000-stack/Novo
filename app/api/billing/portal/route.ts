import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getLemonSqueezySubscription } from '@/lib/lemonsqueezy'

// Redirects an existing Pro subscriber into Lemon Squeezy's hosted Customer
// Portal — avoids building custom cancel/update-card/invoice-history UI.
// The portal URL is pre-signed and only valid 24h, so it's fetched fresh
// from Lemon Squeezy on every call rather than cached.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const subscription = await prisma.subscription.findUnique({ where: { userId: session.user.id } })
  if (!subscription?.lemonsqueezySubscriptionId) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
  }

  const lsSubscription = await getLemonSqueezySubscription(subscription.lemonsqueezySubscriptionId)

  return NextResponse.json({ url: lsSubscription.attributes.urls.customer_portal })
}
