/** @jest-environment node */

import { POST as googlePost } from './google/route'
import { POST as passwordPost } from './login/route'

describe('legacy mobile auth endpoints', () => {
  it.each([
    ['google', googlePost],
    ['password', passwordPost],
  ])('%s is retired instead of minting an unsupported long-lived token', async (_name, post) => {
    const response = await post()
    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({ error: 'MobileAuthDeprecated' })
  })
})
