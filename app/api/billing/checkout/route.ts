import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, STRIPE_PRICE_IDS, BillingInterval } from '@/lib/stripe'

// Creates a Stripe Checkout session for the Novo Pro subscription. Reuses an
// existing Stripe Customer if one was already created for this user (e.g. a
// previous canceled subscription), so billing history stays on one customer.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { interval } = (await request.json().catch(() => ({}))) as { interval?: BillingInterval }
  const priceId = STRIPE_PRICE_IDS[interval === 'year' ? 'year' : 'month']
  if (!priceId) {
    return NextResponse.json({ error: 'Stripe price not configured' }, { status: 500 })
  }

  const existing = await prisma.subscription.findUnique({ where: { userId: session.user.id } })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: existing?.stripeCustomerId,
    customer_email: existing?.stripeCustomerId ? undefined : session.user.email,
    client_reference_id: session.user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/settings?upgraded=1`,
    cancel_url: `${baseUrl}/settings`,
    subscription_data: {
      metadata: { userId: session.user.id },
    },
    metadata: { userId: session.user.id },
  })

  return NextResponse.json({ url: checkoutSession.url })
}
