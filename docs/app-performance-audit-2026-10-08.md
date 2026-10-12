# App performance continuation — 2026-10-08

## Verified change

The cognitive phase subscription used by `PageWrapper`, `DashboardClient`, and
`NowHero` previously consumed the entire cognitive state context. Every metrics
refresh therefore invalidated these surfaces even when the phase stayed the same.

`CognitivePhaseContext` now publishes only the phase. The existing full-state
context remains available to metric consumers. The peak-focus and fatigue hooks
also use the phase subscription.

The render-count regression test exercises the actual provider: an attention
score refresh updates the metric consumer without rendering the phase consumer;
a phase change then renders the phase consumer once and displays the new phase.
This proves subscription isolation, not an end-to-end latency improvement.

## Dashboard details loading

The dashboard previously imported `DashboardQuickView` statically even though it
returned nothing before an activity was selected. That pulled routine-detail and
workout-session dependencies into the initial route dependency graph.

The panel now uses a conditional `next/dynamic` boundary. Selection mounts it for
the first time; closing keeps the selected panel mounted so subsequent reopening
preserves the existing lifecycle. A test using the real Next dynamic loader
confirms that the details module is not evaluated before selection, then loads
once and handles closing/reopening on desktop and mobile.

The two dashboard loading tests and ESLint passed. Production chunk verification
is still required before reporting a payload reduction in bytes.

## Production verification attempt

The local `npm run build` process terminated with
`ERR_MEMORY_ALLOCATION_FAILED` while creating the optimized production build.
No production manifests were available afterward, so chunk placement and byte
savings remain unverified. The host reported about 3.4 GiB physical memory and
0.96 GiB free after termination; the build wrapper already requests a 4096 MiB
Node heap. Increasing that heap is not established as a remedy. No deployment,
migration, or database write was performed.

A fresh targeted run after termination passed four suites/eight tests: real
dashboard dynamic loading (desktop/mobile), phase subscription isolation,
navigation lifecycle, and ambient heartbeat behavior. These verify local
behavior, not authenticated production latency.

The installed Next memory-usage guide documents
`experimental.webpackMemoryOptimizations` as a lower-peak-memory Webpack option.
It is now enabled without changing type-check enforcement or runtime behavior.
A second local build accepted the option and entered compilation, but terminated
with `ENOSPC` while writing build output/cache. C: had no free space when Webpack
reported its first cache-write failure. After termination it had about 67 MiB
free, while `.next/cache` held about 199 MiB. Production verification therefore
remains blocked by disk capacity; no cache or user files have been deleted.
The build-memory guard and real dashboard-loading tests passed again
(two suites, three tests). This is a verification-enabling change, not evidence
of improved application responsiveness.

## Checks

- Phase subscription, cognitive presentation, navigation lifecycle, and ambient
  heartbeat tests: four suites, nine tests passed.
- Liquid-glass budget and build-memory guard tests also passed in the initial
  continuation check, alongside navigation and ambient heartbeat tests.
- ESLint passed for the two edited code files.
- The repository TypeScript check passed with no diagnostics.

## Remaining verification

The September public sign-in timings do not prove authenticated app performance.
Measure initial dashboard load, navigation, scrolling, and idle work with a real
session before declaring the optimization goal complete. Capture request timing,
long tasks, and rendered-frame behavior separately so network delays are not
mistaken for render cost. Animation and effect changes remain a subsequent pass.
