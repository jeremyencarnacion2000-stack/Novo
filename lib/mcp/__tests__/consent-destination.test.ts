import { describeConsentDestination } from '@/lib/mcp/consent-destination'

describe('describeConsentDestination', () => {
  it('does not present an insecure redirect as a verified device connection', () => {
    expect(describeConsentDestination('http://untrusted.example/callback')).toEqual({
      host: 'untrusted.example',
      protocol: 'http:',
      isTrustedTransport: false,
    })
  })

  it('allows a local callback for a desktop MCP client without calling it insecure', () => {
    expect(describeConsentDestination('http://127.0.0.1:43123/callback')).toEqual({
      host: '127.0.0.1:43123',
      protocol: 'http:',
      isTrustedTransport: true,
    })
  })
})
