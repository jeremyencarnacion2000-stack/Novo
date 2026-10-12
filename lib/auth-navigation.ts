type DocumentNavigator = Pick<Location, 'assign'>

/**
 * Capacitor exposes this small bridge in the native WebView. Keeping the
 * check here makes auth routing explicit without importing Capacitor into the
 * browser bundle or relying on a spoofable user-agent string.
 */
export function isNativeShell(): boolean {
  if (typeof window === 'undefined') return false

  const capacitor = (window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean }
  }).Capacitor

  return capacitor?.isNativePlatform?.() === true
}

/**
 * Credential login writes the JWT cookie outside React's SessionProvider.
 * A document navigation is intentional: it recreates the provider from that
 * cookie before the authenticated route guard can act on stale client state.
 */
export function reloadAuthenticatedApp(
  callbackUrl: string,
  navigator: DocumentNavigator = window.location,
): void {
  navigator.assign(callbackUrl)
}

/**
 * SessionProvider can briefly report `unauthenticated` while its initial
 * request is still settling. Confirm that state against the session endpoint
 * before leaving a protected route. A temporary probe failure keeps the
 * current server-protected page in place instead of creating a false logout.
 */
export async function redirectWhenSessionMissing(
  loadSession: () => Promise<unknown>,
  redirect: (path: string) => void,
  missingPath = '/landing',
): Promise<void> {
  try {
    const session = await loadSession()
    if (!session) redirect(missingPath)
  } catch {
    // The server/proxy remains the authority for protected routes. Do not turn
    // a transient client-side session fetch failure into a destructive bounce.
  }
}
