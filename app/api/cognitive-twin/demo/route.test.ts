jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init) },
}))

import { POST } from './route'

describe('synthetic Twin demo endpoint', () => {
  it('does not seed or overwrite a production Twin', async () => {
    const response = await POST()
    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toMatchObject({ code: 'synthetic_twin_demo_disabled' })
  })
})
