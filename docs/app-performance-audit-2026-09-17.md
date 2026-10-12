# Novo app — performance audit (2026-09-17)

## Scope

This measurement covers the authenticated app entry boundary and sign-in
surface. The marketing landing is intentionally excluded. It is a network and
runtime check of the production alias, not a claim about an authenticated
provider session or a native WebView.

## Production sample

Target: `https://productivitynovo.vercel.app/app`

The route correctly redirects to `/auth/signin?callbackUrl=%2Fapp` when no
session exists. A representative warm gstack sample of this app entry measured
the following clean boundaries:

| Metric | Result | Budget / interpretation |
| --- | ---: | --- |
| DNS + TCP + TLS | 0 ms reported after connection reuse | expected for warm navigation |
| TTFB | 50 ms | healthy server boundary |
| DOM interactive | 656 ms | under the 1 s app-shell target |
| Full load | 809 ms | under the 1.5 s unauthenticated target |
| Requests | 16 | below the 30-request entry budget |
| Transfer size | ~344 KB | below the 1 MB entry budget |
| JavaScript transfer | ~209 KB | below the 500 KB entry budget |
| CSS transfer | ~135 KB | included in the entry payload; no separate blocking stylesheet was reported |

The first navigation after starting a fresh browser daemon can include a
one-time browser startup cost (observed outliers ranged from 4.5–7.9 s); it is
not representative of the app request path. The representative warm desktop
reload measured **338 ms** (TTFB 56 ms) and the mobile (390×844) canary measured
**420 ms** (TTFB 49 ms), both below the unauthenticated entry budget. The latest
deployment canary confirmed the same redirect and no console errors. On the
latest deployment, the immediate warm desktop reload measured **341 ms** (83 ms
TTFB), and the mobile 390×844 sample measured **373 ms** (50 ms TTFB). Browser
startup and cache variance materially affect this boundary, so the warm request
path remains the useful regression signal.

## Slowest resources

The slowest resource sample was dominated by parallel browser fetches rather
than a single oversized first-party asset. The largest JavaScript resource was
approximately 66 KB; total JavaScript transfer remained approximately 210 KB.
The sign-in surface does not request the landing's editorial font or landing
animation assets.

## Runtime checks

- Desktop 1280×720 and mobile 390×844 both render the sign-in form cleanly.
- `/app` preserves the callback path through the sign-in redirect.
- No console errors were reported after clearing the console and waiting for
  the page load.
- The latest production deployment (`dpl_FiCHpY2D1HVQkFMt7QfK4sPtDW6V`) was
  rechecked on both the desktop and mobile entry boundaries after the final
  Analytics `UserSession` replay, bounded provider-search, routine-history
  ownership/window checks, Calendar auth and modal viewport fixes. The current
  desktop 1440×900 warm sample completed in 322 ms (58 ms TTFB) and the mobile
  390×844 warm sample completed in 211 ms (50 ms TTFB), with no console errors.
  Browser startup/cache variance can make a fresh process slower; the warm
  request path remained below the unauthenticated budget.
- `/auth/reset-password` loads the public recovery surface with no console errors
  after a clean reload; it does not reveal whether an email exists.
- `/api/books` and `/api/integration/status` return `401 {"error":"Unauthorized"}`
  without a session, with no provider details exposed.
- `/api/youtube/account` also returns the same safe `401` boundary without a
  session after moving its Google grant lookup server-side.
- The app's hidden-tab polling, RAF loops and timers are paused or cancelled by
  the current lifecycle guards; the focused regression suite covers these
  boundaries where applicable.
- The production database has the additive activity-query indexes applied for
  routine history, workout logs and tracker entries, matching the hot filters
  used by the app and Twin context reads.

## Limits of this measurement

An authenticated run still needs the user's real session and provider accounts.
Lemon Squeezy Live checkout/webhooks and Android/iOS system-browser/deep-link
flows require external environments, so they are release gates rather than
performance conclusions from this document.
