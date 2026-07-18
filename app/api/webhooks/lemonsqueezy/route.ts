import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LEMONSQUEEZY_VARIANT_IDS } from '@/lib/lemonsqueezy'

// Single source of truth for plan state — every subscription lifecycle event
// (created, renewed, past due, cancelled, expired) lands here and updates
// both Subscription (billing detail) and User.plan (the fast gating read).
// Mirrors app/api/webhooks/stripe/route.ts's role for the Stripe path.
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-signature')

  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? ''
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  const signatureBuffer = Buffer.from(signature ?? '', 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  const isValid =
    signatureBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(signatureBuffer, expectedBuffer)

  if (!isValid) {
    console.error('[Lemon Squeezy Webhook] Signature verification failed')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(body)
  const eventName = event.meta?.event_name as string | undefined

  try {
    if (eventName?.startsWith('subscription_')) {
      const userId = event.meta?.custom_data?.user_id as string | undefined
      if (!userId) {
        console.error('[Lemon Squeezy Webhook] Missing custom_data.user_id on', eventName)
        return NextResponse.json({ received: true })
      }
      await upsertSubscription(userId, event.data)
    }
  } catch (error) {
    console.error('[Lemon Squeezy Webhook] Handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function upsertSubscription(userId: string, sub: any) {
  const attrs = sub.attributes
  const status = attrs.status as string

  // 'cancelled' keeps access through the paid period already covered —
  // ends_at is when it actually stops. Everything else (past_due, unpaid,
  // paused, expired) does not grant access.
  const isActive =
    status === 'active' ||
    status === 'on_trial' ||
    (status === 'cancelled' && attrs.ends_at && new Date(attrs.ends_at) > new Date())

  const currentPeriodEnd = attrs.renews_at
    ? new Date(attrs.renews_at)
    : attrs.ends_at
      ? new Date(attrs.ends_at)
      : null

  const variantId = String(attrs.variant_id)
  const interval =
    variantId === LEMONSQUEEZY_VARIANT_IDS.year ? 'year'
    : variantId === LEMONSQUEEZY_VARIANT_IDS.month ? 'month'
    : null

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      provider: 'lemonsqueezy',
      lemonsqueezyCustomerId: String(attrs.customer_id),
      lemonsqueezySubscriptionId: sub.id,
      lemonsqueezyVariantId: variantId,
      status: isActive ? 'active' : status,
      interval,
      currentPeriodEnd,
      cancelAtPeriodEnd: !!attrs.cancelled,
    },
    update: {
      provider: 'lemonsqueezy',
      lemonsqueezyCustomerId: String(attrs.customer_id),
      lemonsqueezySubscriptionId: sub.id,
      lemonsqueezyVariantId: variantId,
      status: isActive ? 'active' : status,
      interval,
      currentPeriodEnd,
      cancelAtPeriodEnd: !!attrs.cancelled,
    },
  })

  await prisma.user.update({
    where: { id: userId },
    data: { plan: isActive ? 'pro' : 'free' },
  })
}
