import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createLemonSqueezyCheckout, LEMONSQUEEZY_VARIANT_IDS, type BillingInterval } from '@/lib/lemonsqueezy'

// Creates a Lemon Squeezy Checkout for the Novo Pro subscription. Lemon
// Squeezy is the live billing path (Merchant of Record) since Stripe isn't
// usable for accounts based in the Dominican Republic — see lib/stripe.ts
// and app/api/webhooks/stripe/route.ts, left in place so Stripe auto-recovers
// if it's ever enabled for this account.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { interval } = (await request.json().catch(() => ({}))) as { interval?: BillingInterval }
  const variantId = LEMONSQUEEZY_VARIANT_IDS[interval === 'year' ? 'year' : 'month']
  if (!variantId) {
    return NextResponse.json({ error: 'Lemon Squeezy variant not configured' }, { status: 500 })
  }

  const url = await createLemonSqueezyCheckout({
    variantId,
    userId: session.user.id,
    email: session.user.email,
  })

  return NextResponse.json({ url })
}
