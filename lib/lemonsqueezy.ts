// Lemon Squeezy REST API client — plain fetch, no SDK dependency needed for
// the two calls Novo makes (create checkout, read subscription). Used as the
// live billing path since Stripe isn't usable for accounts based in the
// Dominican Republic; Lemon Squeezy is a Merchant of Record so it also
// handles tax/compliance Stripe would otherwise leave to us.
const LEMONSQUEEZY_API_BASE = 'https://api.lemonsqueezy.com/v1'

export class LemonSqueezyError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 500,
  ) {
    super(code)
    this.name = 'LemonSqueezyError'
  }
}

function lemonSqueezyHeaders() {
  return {
    Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY ?? ''}`,
    'Content-Type': 'application/vnd.api+json',
    Accept: 'application/vnd.api+json',
  }
}

export const LEMONSQUEEZY_VARIANT_IDS = {
  month: process.env.LEMONSQUEEZY_VARIANT_ID_MONTHLY ?? '',
  year: process.env.LEMONSQUEEZY_VARIANT_ID_YEARLY ?? '',
} as const

export type BillingInterval = keyof typeof LEMONSQUEEZY_VARIANT_IDS

const REQUIRED_SUBSCRIPTION_EVENTS = new Set([
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_expired',
])

function normalizeUrl(value: string) {
  return value.replace(/\/$/, '')
}

async function lemonSqueezyGet(path: string) {
  const res = await fetch(`${LEMONSQUEEZY_API_BASE}${path}`, {
    headers: lemonSqueezyHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new LemonSqueezyError('provider_unavailable', res.status)
  }

  return res.json()
}

/**
 * Fail closed before accepting money. Lemon Squeezy publishes products while a
 * usable live variant may still expose the provider-internal `pending` status.
 * A checkout is production-ready only when both configured variants belong to
 * published live products and the signed subscription webhook points back to
 * this exact Novo deployment.
 */
export async function verifyLemonSqueezyConfiguration(params: {
  appUrl: string
  requireLive?: boolean
}) {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY ?? ''
  const storeId = process.env.LEMONSQUEEZY_STORE_ID ?? ''
  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? ''
  const variantIds = Object.values(LEMONSQUEEZY_VARIANT_IDS)
  if (!apiKey || !storeId || !webhookSecret || variantIds.some((id) => !id)) {
    throw new LemonSqueezyError('configuration_missing', 503)
  }

  const [month, year, webhookResponse] = await Promise.all([
    lemonSqueezyGet(`/variants/${encodeURIComponent(LEMONSQUEEZY_VARIANT_IDS.month)}`),
    lemonSqueezyGet(`/variants/${encodeURIComponent(LEMONSQUEEZY_VARIANT_IDS.year)}`),
    lemonSqueezyGet('/webhooks'),
  ])

  const variantResources = [month?.data, year?.data]
  const variants = variantResources.map((variant) => variant?.attributes)
  if (variants.some((variant) => !variant)) {
    throw new LemonSqueezyError('variant_not_ready', 503)
  }

  const requireLive = params.requireLive ?? process.env.NODE_ENV === 'production'
  if (requireLive && variants.some((variant) => variant.test_mode !== false)) {
    throw new LemonSqueezyError('test_mode_not_allowed', 503)
  }

  const productIds = variantResources.map((variant) => String(
    variant?.attributes?.product_id
      ?? variant?.relationships?.product?.data?.id
      ?? '',
  ))
  const variantStoreIds = variantResources.map((variant) => String(
    variant?.attributes?.store_id
      ?? variant?.relationships?.store?.data?.id
      ?? storeId,
  ))
  if (productIds.some((id) => !id) || variantStoreIds.some((id) => id !== storeId)) {
    throw new LemonSqueezyError('variant_not_ready', 503)
  }

  const productResponses = await Promise.all(productIds.map((productId) =>
    lemonSqueezyGet(`/products/${encodeURIComponent(productId)}`),
  ))
  const products = productResponses.map((product) => product?.data?.attributes)
  if (products.some((product) => !product || product.status !== 'published')) {
    throw new LemonSqueezyError('product_not_published', 503)
  }
  if (requireLive && products.some((product) => product.test_mode !== false)) {
    throw new LemonSqueezyError('test_mode_not_allowed', 503)
  }

  const expectedWebhookUrl = `${normalizeUrl(params.appUrl)}/api/webhooks/lemonsqueezy`
  const webhooks = Array.isArray(webhookResponse?.data) ? webhookResponse.data : []
  const webhook = webhooks.find((candidate: any) =>
    normalizeUrl(String(candidate?.attributes?.url ?? '')) === expectedWebhookUrl,
  )
  const events = new Set<string>(Array.isArray(webhook?.attributes?.events) ? webhook.attributes.events : [])
  const hasRequiredEvents = [...REQUIRED_SUBSCRIPTION_EVENTS].every((event) => events.has(event))
  if (!webhook || !hasRequiredEvents || (requireLive && webhook.attributes?.test_mode !== false)) {
    throw new LemonSqueezyError('webhook_not_ready', 503)
  }

  return { mode: requireLive ? 'live' as const : 'test' as const }
}

// Creates a hosted checkout for the given variant and returns its URL.
// custom.user_id round-trips through Lemon Squeezy into every webhook event
// for this checkout (under meta.custom_data), the same role client_reference_id
// plays for Stripe.
export async function createLemonSqueezyCheckout(params: {
  variantId: string
  userId: string
  email: string
  redirectUrl: string
  source?: string
  receiptButtonText: string
  receiptThankYouNote: string
}): Promise<string> {
  const res = await fetch(`${LEMONSQUEEZY_API_BASE}/checkouts`, {
    method: 'POST',
    headers: lemonSqueezyHeaders(),
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          product_options: {
            enabled_variants: [Number(params.variantId)],
            redirect_url: params.redirectUrl,
            receipt_button_text: params.receiptButtonText,
            receipt_link_url: params.redirectUrl,
            receipt_thank_you_note: params.receiptThankYouNote,
          },
          checkout_options: {
            media: false,
            logo: true,
            desc: true,
            discount: true,
            subscription_preview: true,
            button_color: '#86efac',
          },
          checkout_data: {
            email: params.email,
            custom: {
              user_id: params.userId,
              paywall_source: params.source ?? 'settings',
            },
          },
        },
        relationships: {
          store: { data: { type: 'stores', id: process.env.LEMONSQUEEZY_STORE_ID ?? '' } },
          variant: { data: { type: 'variants', id: params.variantId } },
        },
      },
    }),
  })

  if (!res.ok) {
    throw new LemonSqueezyError('checkout_create_failed', res.status)
  }

  const json = await res.json()
  const url = String(json?.data?.attributes?.url ?? '')
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.lemonsqueezy.com')) {
    throw new LemonSqueezyError('invalid_checkout_url', 502)
  }
  return url
}

// Subscription object shape as returned by Lemon Squeezy's API — only the
// fields Novo actually reads.
export interface LemonSqueezySubscription {
  id: string
  attributes: {
    customer_id: number
    variant_id: number
    status: string // 'on_trial' | 'active' | 'paused' | 'past_due' | 'unpaid' | 'cancelled' | 'expired'
    renews_at: string | null
    ends_at: string | null
    cancelled: boolean
    urls: { customer_portal: string; update_payment_method: string }
  }
}

export async function getLemonSqueezySubscription(subscriptionId: string): Promise<LemonSqueezySubscription> {
  const res = await fetch(`${LEMONSQUEEZY_API_BASE}/subscriptions/${subscriptionId}`, {
    headers: lemonSqueezyHeaders(),
  })

  if (!res.ok) {
    throw new LemonSqueezyError('subscription_fetch_failed', res.status)
  }

  const json = await res.json()
  return json.data as LemonSqueezySubscription
}
