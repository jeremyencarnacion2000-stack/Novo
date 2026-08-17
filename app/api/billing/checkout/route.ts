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

  const { interval, source, locale } = (await request.json().catch(() => ({}))) as {
    interval?: BillingInterval
    source?: string
    locale?: string
  }
  const variantId = LEMONSQUEEZY_VARIANT_IDS[interval === 'year' ? 'year' : 'month']
  if (!variantId) {
    return NextResponse.json({ error: 'Lemon Squeezy variant not configured' }, { status: 500 })
  }

  const receiptCopy = {
    es: {
      button: 'Volver a Novo',
      note: 'Gracias por elegir Novo Pro. Tu plan se activará automáticamente en tu cuenta.',
    },
    en: {
      button: 'Return to Novo',
      note: 'Thank you for choosing Novo Pro. Your plan will activate automatically in your account.',
    },
    fr: {
      button: 'Retourner à Novo',
      note: 'Merci d’avoir choisi Novo Pro. Votre forfait sera activé automatiquement dans votre compte.',
    },
    de: {
      button: 'Zurück zu Novo',
      note: 'Danke, dass du Novo Pro gewählt hast. Dein Tarif wird automatisch in deinem Konto aktiviert.',
    },
  } as const
  const safeLocale = locale === 'es' || locale === 'fr' || locale === 'de' ? locale : 'en'
  const appUrl = (process.env.NEXTAUTH_URL || request.nextUrl.origin).replace(/\/$/, '')
  const url = await createLemonSqueezyCheckout({
    variantId,
    userId: session.user.id,
    email: session.user.email,
    source,
    redirectUrl: `${appUrl}/settings?tab=billing&upgraded=1`,
    receiptButtonText: receiptCopy[safeLocale].button,
    receiptThankYouNote: receiptCopy[safeLocale].note,
  })

  return NextResponse.json({ url })
}
