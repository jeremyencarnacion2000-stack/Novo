/**
 * @jest-environment node
 */

import { createLemonSqueezyCheckout } from '@/lib/lemonsqueezy'

describe('Lemon Squeezy checkout handoff', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  test('preserves attribution and returns the customer to the billing confirmation flow', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { attributes: { url: 'https://novo.lemonsqueezy.com/checkout/custom/test' } },
      }),
    })
    global.fetch = fetchMock as typeof fetch

    const checkoutUrl = await createLemonSqueezyCheckout({
      variantId: '456',
      userId: 'user_123',
      email: 'person@example.com',
      source: 'landing-intent',
      redirectUrl: 'https://productivitynovo.vercel.app/settings?tab=billing&upgraded=1',
      receiptButtonText: 'Return to Novo',
      receiptThankYouNote: 'Your plan will activate automatically.',
    })

    expect(checkoutUrl).toBe('https://novo.lemonsqueezy.com/checkout/custom/test')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const request = fetchMock.mock.calls[0][1]
    const body = JSON.parse(request.body)
    expect(body.data.attributes.product_options).toMatchObject({
      enabled_variants: [456],
      redirect_url: 'https://productivitynovo.vercel.app/settings?tab=billing&upgraded=1',
      receipt_button_text: 'Return to Novo',
      receipt_link_url: 'https://productivitynovo.vercel.app/settings?tab=billing&upgraded=1',
    })
    expect(body.data.attributes.checkout_options.subscription_preview).toBe(true)
    expect(body.data.attributes.checkout_data).toMatchObject({
      email: 'person@example.com',
      custom: {
        user_id: 'user_123',
        paywall_source: 'landing-intent',
      },
    })
  })
})
