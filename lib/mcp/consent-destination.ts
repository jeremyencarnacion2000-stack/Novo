export type ConsentDestination = {
  host: string
  protocol: string | null
  isTrustedTransport: boolean
}

/**
 * Produces the small, user-facing destination summary shown before OAuth
 * consent. OAuth itself validates redirect URIs; this prevents the UI from
 * accidentally presenting an arbitrary HTTP endpoint as a trusted device.
 */
export function describeConsentDestination(redirectUri: string): ConsentDestination {
  try {
    const url = new URL(redirectUri)
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
    return {
      host: url.host || 'Unknown destination',
      protocol: url.protocol,
      isTrustedTransport: url.protocol === 'https:' || (url.protocol === 'http:' && isLocalhost),
    }
  } catch {
    return { host: 'Unknown destination', protocol: null, isTrustedTransport: false }
  }
}
