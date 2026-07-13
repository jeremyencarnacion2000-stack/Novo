import Stripe from 'stripe'

// Lazily constructed so importing this module never throws when
// STRIPE_SECRET_KEY is unset (e.g. local dev, `next build` page-data collection) —
// it only throws if a route actually calls the Stripe API without a key.
let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
      apiVersion: '2026-06-24.dahlia',
    })
  }
  return _stripe
}

export const stripe = new Proxy({} as Stripe, {
  get: (_target, prop) => Reflect.get(getStripe(), prop, getStripe()),
})

export const STRIPE_PRICE_IDS = {
  month: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
  year: process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
} as const

export type BillingInterval = keyof typeof STRIPE_PRICE_IDS
