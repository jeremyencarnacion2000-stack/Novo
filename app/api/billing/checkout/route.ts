import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import {
  createLemonSqueezyCheckout,
  LemonSqueezyError,
  LEMONSQUEEZY_VARIANT_IDS,
  verifyLemonSqueezyConfiguration,
} from '@/lib/lemonsqueezy'

const checkoutSchema = z.object({
  interval: z.enum(['month', 'year']).default('month'),
  source: z.enum(['settings', 'twin-mode', 'limit', 'landing-intent']).default('settings'),
  locale: z.enum(['en', 'es', 'fr', 'de']).default('en'),
})

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

  const parsedInput = checkoutSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsedInput.success) {
    return NextResponse.json({ error: 'Invalid checkout request' }, { status: 400 })
  }
  const { interval, source, locale } = parsedInput.data
  const variantId = LEMONSQUEEZY_VARIANT_IDS[interval]
  if (!variantId) {
    return NextResponse.json({ error: 'Billing is temporarily unavailable' }, { status: 503 })
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
  const appUrl = (process.env.NEXTAUTH_URL || request.nextUrl.origin).replace(/\/$/, '')
  try {
    await verifyLemonSqueezyConfiguration({ appUrl })
    const url = await createLemonSqueezyCheckout({
      variantId,
      userId: session.user.id,
      email: session.user.email,
      source,
      redirectUrl: `${appUrl}/settings?tab=billing&upgraded=1`,
      receiptButtonText: receiptCopy[locale].button,
      receiptThankYouNote: receiptCopy[locale].note,
    })

    return NextResponse.json({ url })
  } catch (error) {
    const code = error instanceof LemonSqueezyError ? error.code : 'checkout_unavailable'
    console.error('[Billing] Lemon Squeezy checkout unavailable:', code)
    return NextResponse.json({ error: 'Billing is temporarily unavailable' }, { status: 503 })
  }
}
