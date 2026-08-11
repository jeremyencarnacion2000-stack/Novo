// Lemon Squeezy REST API client — plain fetch, no SDK dependency needed for
// the two calls Novo makes (create checkout, read subscription). Used as the
// live billing path since Stripe isn't usable for accounts based in the
// Dominican Republic; Lemon Squeezy is a Merchant of Record so it also
// handles tax/compliance Stripe would otherwise leave to us.
const LEMONSQUEEZY_API_BASE = 'https://api.lemonsqueezy.com/v1'

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
    throw new Error(`Lemon Squeezy checkout creation failed: ${res.status} ${await res.text()}`)
  }

  const json = await res.json()
  return json.data.attributes.url as string
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
    throw new Error(`Lemon Squeezy subscription fetch failed: ${res.status} ${await res.text()}`)
  }

  const json = await res.json()
  return json.data as LemonSqueezySubscription
}
