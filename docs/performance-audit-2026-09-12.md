# Novo performance baseline · 2026-09-12

## Scope

Measured against the production alias `https://productivitynovo.vercel.app`
with the gstack browser at desktop viewport. The public landing and the web
sign-in handoff were checked separately because authenticated app routes require
a real session.

## Measurements

Latest production spot-check (alias `productivitynovo.vercel.app`, fresh
navigation in the gstack browser, 2026-09-12): TTFB **62 ms**, first paint /
FCP **1,204 ms**, DOM interactive **1,171 ms**, DOM complete **2,294 ms**,
and load **2,295 ms**. The page returned HTTP 200 with no console errors.
This is a directional browser measurement; compare from a fresh context when
investigating regressions.

Post-release canary (2026-09-14, deployment `dpl_54iiKYxJz5vLF4rynWL7rWEkGxVW`)

Follow-up production deployment (2026-09-14, `dpl_HZSrGFHgPUoHEBd5Aed28ZBMaUGg`) completed the same visual path plus cognitive check-in retry protection. Desktop and mobile landing canaries reached `readyState=complete`, removed the loader, and reported no console errors; the mobile parallax container remains clipped with `overflow-x-hidden` by design.

Fresh production measurement (2026-09-14): DNS 2 ms, TCP 105 ms, TLS 69 ms,
TTFB 50 ms, download 149 ms, DOM parse 430 ms, DOM ready 744 ms, load 830 ms.
measured DNS **6 ms**, TCP **128 ms**, TLS **86 ms**, TTFB **50 ms**, DOM ready
**1,051 ms**, and load **1,149 ms** at `1280x720`; the landing returned HTTP 200
with no console errors.

Latest visual deployment canary (2026-09-14, `dpl_54iiKYxJz5vLF4rynWL7rWEkGxVW`):
desktop `1280x720` returned HTTP 200 with `readyState=complete`, `scrollWidth=1280`,
and no console errors; mobile `390x844` returned HTTP 200 with `scrollWidth=390`
and no console errors. The loader was absent after completion. Its full-load timing
was DNS 46 ms, TCP 126 ms, TLS 87 ms, TTFB 50 ms, DOM ready 4,180 ms, and load
4,290 ms; this includes the intentional 16-frame loader sequence.

| Surface | TTFB | FCP | DOM interactive | DOM complete | Requests | Transfer |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/landing` | 49 ms | 712 ms | 666 ms | 1,632 ms | 59 | ~3.96 MB |
| `/auth/signin?callbackUrl=%2Fapp` | 49 ms | 1,396 ms | 221 ms | 818 ms | 44 | ~127 KB |

Release canary `dpl_Hyoz97igWb3xv9vCyYG9QK4qPCLj` returned the public landing in
the latest production spot-check with 62 ms TTFB and 1,171 ms DOM interactive,
and the app-only unauthenticated
guard at `/auth/signin?callbackUrl=%2Fapp`, with no console errors. The API
canary for routine import and user template creation correctly returned `401 Unauthorized` when
no session was present.

The browser session reported no console errors on either surface. Resource
timings are a directional baseline: cached resources can report a small or zero
`transferSize`, so changes should be compared from a fresh browser context when
investigating a regression.

The latest Twin reset hardening keeps the operation transactional and pauses
background hydration while it is in flight, preventing stale server state from
flashing back into the client after a reset.

The AI stream now validates and bounds request bodies before starting activity,
while non-image attachments avoid persisting large base64 payloads. Image-load
failures resolve through a safe fallback so the composer cannot hang indefinitely.

## Current budget interpretation

- Landing TTFB and FCP are within a healthy first-view target.
- The landing's transfer budget is the main optimization surface. Its first
  viewport intentionally preloads the editorial loader and layered artwork;
  keep the story, but avoid adding more above-the-fold fonts or uncompressed
  raster art.
- The sign-in bundle is small. Its FCP is later than DOM interactive because the
  editorial panel and web fonts continue painting after the document is ready.
- The 16-frame loader now uses a dedicated optimized WebP set under
  `public/landing/loader-optimized/`; the frame payload is about 0.82 MB in
  total instead of shipping the original multi-megabyte source frames.
- A public-asset sweep removed 14 unreferenced editorial renders (~19 MB);
  the source copies remain outside the deploy tree under the local `.codex`
  archive for recovery if a future art pass needs them.

## Guardrails for future changes

1. Keep the native/PWA entry at `/app`; do not add landing assets to
   `native-shell/`, Android, or iOS bundles.
2. Preserve lazy loading for authenticated widgets and route-level code split.
3. Keep new landing images in WebP/AVIF with intrinsic dimensions and lazy-load
   anything below the first viewport.
4. Re-run the same measurements after changes to `app/landing`, global font
   loading, `ClientLayout`, or liquid-glass surfaces.
5. Treat a >500 ms absolute or >50% timing increase, or >25% bundle increase,
   as a regression requiring investigation.
