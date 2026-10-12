import fs from 'node:fs'
import path from 'node:path'

describe('cognitive native/app auth boundary', () => {
  it('returns expired sessions to sign-in instead of the public landing', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'app/cognitive/cognitive-client-layout.tsx'),
      'utf8',
    )

    expect(source).not.toContain("router.replace('/landing')")
    expect(source).toContain("/auth/signin?callbackUrl=")
    expect(source).toContain("encodeURIComponent(callbackPath)")
  })
})
