import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

// Single source of truth for plan state — every subscription lifecycle event
// (checkout completed, renewed, past due, canceled) lands here and updates
// both Subscription (billing detail) and User.plan (the fast gating read).
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature!, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.client_reference_id || session.metadata?.userId
        if (!userId || !session.customer || !session.subscription) break

        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        await upsertSubscription(userId, session.customer as string, sub)
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.userId
        if (!userId) break
        await upsertSubscription(userId, sub.customer as string, sub)
        break
      }

      default:
        break
    }
  } catch (error) {
    console.error('[Stripe Webhook] Handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function upsertSubscription(userId: string, stripeCustomerId: string, sub: Stripe.Subscription) {
  const isActive = sub.status === 'active' || sub.status === 'trialing'
  const priceId = sub.items.data[0]?.price.id
  const interval = sub.items.data[0]?.price.recurring?.interval ?? null
  // Stripe API 2025-03-31+ moved current_period_end from Subscription to each SubscriptionItem
  const currentPeriodEnd = new Date((sub.items.data[0]?.current_period_end ?? 0) * 1000)

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      status: isActive ? 'active' : sub.status,
      interval,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
    update: {
      stripeCustomerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      status: isActive ? 'active' : sub.status,
      interval,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  })

  await prisma.user.update({
    where: { id: userId },
    data: { plan: isActive ? 'pro' : 'free' },
  })
}
