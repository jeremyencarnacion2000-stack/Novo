/**
 * @jest-environment node
 */

const ORIGINAL_ENV = { ...process.env }

function configureBillingEnv() {
  process.env.LEMONSQUEEZY_API_KEY = 'safe_test_key'
  process.env.LEMONSQUEEZY_STORE_ID = 'store_1'
  process.env.LEMONSQUEEZY_VARIANT_ID_MONTHLY = 'variant_month'
  process.env.LEMONSQUEEZY_VARIANT_ID_YEARLY = 'variant_year'
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = 'webhook_secret'
}

function variant(productId: string, testMode = false, status = 'pending') {
  return {
    ok: true,
    json: async () => ({
      data: {
        attributes: { status, test_mode: testMode, product_id: productId, store_id: 'store_1' },
      },
    }),
  }
}

function product(testMode = false, status = 'published') {
  return { ok: true, json: async () => ({ data: { attributes: { status, test_mode: testMode } } }) }
}

function webhooks(testMode = false) {
  return {
    ok: true,
    json: async () => ({
      data: [{
        attributes: {
          url: 'https://productivitynovo.vercel.app/api/webhooks/lemonsqueezy',
          test_mode: testMode,
          events: ['subscription_created', 'subscription_updated', 'subscription_cancelled', 'subscription_expired'],
        },
      }],
    }),
  }
}

describe('Lemon Squeezy production readiness', () => {
  beforeEach(() => {
    jest.resetModules()
    configureBillingEnv()
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    jest.restoreAllMocks()
  })

  test('passes when pending live variants belong to published live products and the webhook is live', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(variant('product_month'))
      .mockResolvedValueOnce(variant('product_year'))
      .mockResolvedValueOnce(webhooks(false))
      .mockResolvedValueOnce(product(false))
      .mockResolvedValueOnce(product(false)) as typeof fetch

    const { verifyLemonSqueezyConfiguration } = await import('@/lib/lemonsqueezy')
    await expect(verifyLemonSqueezyConfiguration({
      appUrl: 'https://productivitynovo.vercel.app',
      requireLive: true,
    })).resolves.toEqual({ mode: 'live' })
  })

  test('rejects test-mode variants in a live deployment', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(variant('product_month', true))
      .mockResolvedValueOnce(variant('product_year', true))
      .mockResolvedValueOnce(webhooks(true)) as typeof fetch

    const { verifyLemonSqueezyConfiguration } = await import('@/lib/lemonsqueezy')
    await expect(verifyLemonSqueezyConfiguration({
      appUrl: 'https://productivitynovo.vercel.app',
      requireLive: true,
    })).rejects.toMatchObject({ code: 'test_mode_not_allowed' })
  })

  test('rejects a deployment without the exact subscription webhook', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(variant('product_month'))
      .mockResolvedValueOnce(variant('product_year'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce(product(false))
      .mockResolvedValueOnce(product(false)) as typeof fetch

    const { verifyLemonSqueezyConfiguration } = await import('@/lib/lemonsqueezy')
    await expect(verifyLemonSqueezyConfiguration({
      appUrl: 'https://productivitynovo.vercel.app',
      requireLive: true,
    })).rejects.toMatchObject({ code: 'webhook_not_ready' })
  })

  test('rejects variants whose products are not published', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(variant('product_month'))
      .mockResolvedValueOnce(variant('product_year'))
      .mockResolvedValueOnce(webhooks(false))
      .mockResolvedValueOnce(product(false, 'draft'))
      .mockResolvedValueOnce(product(false)) as typeof fetch

    const { verifyLemonSqueezyConfiguration } = await import('@/lib/lemonsqueezy')
    await expect(verifyLemonSqueezyConfiguration({
      appUrl: 'https://productivitynovo.vercel.app',
      requireLive: true,
    })).rejects.toMatchObject({ code: 'product_not_published' })
  })

  test('fails closed when a required secret is absent', async () => {
    delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET
    const fetchMock = jest.fn()
    global.fetch = fetchMock as typeof fetch

    const { verifyLemonSqueezyConfiguration } = await import('@/lib/lemonsqueezy')
    await expect(verifyLemonSqueezyConfiguration({
      appUrl: 'https://productivitynovo.vercel.app',
      requireLive: true,
    })).rejects.toMatchObject({ code: 'configuration_missing' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
