import { NextRequest, NextResponse } from 'next/server'

/**
 * Public contribution entrypoint. It deliberately does not require a Novo
 * session: Lemon Squeezy owns checkout, receipt and payment identity. Configure
 * one hosted checkout URL per interval in the deployment environment.
 */
export async function GET(request: NextRequest) {
  const interval = request.nextUrl.searchParams.get('interval') === 'year' ? 'year' : 'month'
  const url = interval === 'year'
    ? process.env.LEMONSQUEEZY_DIRECT_CHECKOUT_URL_YEAR
    : process.env.LEMONSQUEEZY_DIRECT_CHECKOUT_URL_MONTH

  if (!url) {
    return NextResponse.json({ error: 'Direct Lemon Squeezy checkout is not configured' }, { status: 503 })
  }

  try {
    const checkout = new URL(url)
    if (checkout.protocol !== 'https:') throw new Error('invalid_checkout_protocol')
    return NextResponse.redirect(checkout.toString(), 302)
  } catch {
    return NextResponse.json({ error: 'Invalid direct checkout configuration' }, { status: 503 })
  }
}
