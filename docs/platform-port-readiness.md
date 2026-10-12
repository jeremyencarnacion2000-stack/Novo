# Novo platform port readiness

## Current product boundary

Novo is a server-backed, authenticated Next.js product. The web application and
its installed PWA are the supported client today. They preserve the same
NextAuth session, API routes, cognitive reconciliation, provider callbacks and
database ownership checks as the browser product.

The repository includes generated `android/` and `ios/` Capacitor projects. The
native shell is intentionally configured as a server-backed client: it opens
`/app` on the deployed Novo origin and does not package or show the public
landing. The local `native-shell/` bundle is only a branded redirect fallback
used by `cap copy`, never the product surface.

`/app` is the app-only resolver: an unauthenticated user is sent to the web
login with `/app` as the callback, a new signed-in user continues to onboarding,
and a completed Twin enters the authenticated product shell at `/`. This keeps login and
onboarding global across desktop, PWA and native ports without mounting the
landing inside an installed app.

## Retired unsupported mobile authentication

`/api/auth/mobile/google` and `/api/auth/mobile/login` now return `410`. They
previously issued long-lived JWTs that ordinary Novo APIs did not authenticate,
so they were neither a complete mobile session nor a safe production boundary.
There is no shipped native client depending on them.

The supported mobile path today is the installed PWA/browser session. A native
port must implement the system-browser/deep-link architecture below before it
can reintroduce any mobile-specific authentication endpoint.

## What is ready now

- Responsive web and PWA shell with manifest, icons and a versioned service
  worker.
- Android and iOS project scaffolds synced with `npx cap sync`; both generated
  assets point at the production `/app` resolver and contain no landing bundle.
- Device-presence capture inside Novo, stored through the shared cognitive
  signal pipeline. It records only the consented surface class
  (`web_desktop`, `web_mobile`, `pwa_desktop`, `pwa_mobile`), never a raw
  device identifier or user agent.
- Web OAuth redirect callbacks for the supported provider integrations.
- Server-owned context, task, outcome and Twin APIs. No client is trusted with
  a user id.
- The authenticated app guard sends any missing or expired app session (PWA,
  desktop browser or Capacitor) to the web sign-in route with a same-origin
  callback to the current app route; it never falls back to `/landing`.

## Required native architecture

Native clients must use the deployed Novo web/API origin for server state and
launch OAuth in the system browser. They must return through verified universal
links/app links, then exchange only the scoped authorization result with Novo.
An embedded WebView must not impersonate Chrome or bypass provider OAuth rules.

```text
Native app (Capacitor server.url -> /app)
  -> system browser OAuth
  -> https://productivitynovo.vercel.app/api/integration/<provider>/callback
  -> verified universal/app link back to native app
  -> /app resolver -> onboarding or /
  -> Novo API + persisted cognitive context
```

## Release gates for Android and iOS

1. Keep the generated native projects on a dedicated port branch and build
   Android with the installed SDK and iOS on macOS/Xcode.
2. Keep the server-backed strategy used by `capacitor.config.ts`. The
   `build:cap` command now verifies this server-backed Next build; it does not
   create a static landing bundle. The native shell must continue using the
   deployed `/app` origin for authentication, onboarding, authenticated API routes, background
   reconciliation and OAuth callbacks.
3. Register Android App Links and iOS Universal Links for the production domain.
4. Test Google, GitHub, Todoist, Slack and Notion OAuth in the system browser on
   real devices, including cancel, expired state, and account switching.
5. Add OS permissions one at a time with a clear user-facing reason. Device
   usage, notification and location data cannot be silently collected.
6. Add a native signal adapter that writes only consented, minimized events into
   the existing PlatformSignal pipeline.
7. Run two-account, offline, resume, deep-link, sign-out and token-revocation
   tests before store submission.

## Security baseline

- Capacitor no longer enables mixed content.
- Capacitor no longer spoofs a browser user agent to evade OAuth policy.
- The service worker never caches authenticated `/api/*` responses.
- Native development must use a disposable test database and test provider
  accounts. Production tokens must not be embedded in an app bundle.

## Current certification

| Surface | State | Evidence |
| --- | --- | --- |
| Web/PWA | Ready for release gate | manifest, service worker, responsive web shell |
| Desktop browser | Supported | same server-backed application |
| Android native | Scaffold ready, not certified | generated project and synced app-only assets; real-device build/OAuth proof remains |
| iOS native | Scaffold ready, not certified | generated project and synced app-only assets; macOS/Xcode entitlement and real-device proof remains |

Latest local port check (2026-09-17): `npm run build:cap` completed with the
server-backed Next build and TypeScript/static generation (`133/133`).
`npx cap doctor` reports Android healthy; iOS cannot be certified on this
Windows host because Xcode is unavailable. This is an environment gate, not a
runtime fallback: both shells still point at the shared `/app` resolver.

This document is deliberately a readiness boundary, not a promise that native
apps already exist. It prevents a release from silently losing authentication,
provider context, or the Twin's durable server state.
