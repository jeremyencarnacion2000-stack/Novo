# Phase 2 material stress evidence

Recorded: 2026-08-10

## Automated contract evidence

`components/settings/__tests__/settings-personalization.test.tsx` renders the
personalization screen through the real `SettingsProvider`, selects a wallpaper,
and verifies all of the following without saving or reloading:

- The preview canvas applies the selected `backgroundImage` through the CSS
  `background` shorthand, so the selected URL is an actual renderable image
  value rather than an invalid `background-color` value.
- The preview contains the shared `GlassSurface` Context Glass role
  (`novo-context-glass`) and the shared `Card` Focus Surface role
  (`novo-focus-surface`).
- Native `input` events for card opacity and refraction blur update the shared
  `--novo-focus-background` and `--novo-focus-backdrop-filter` document
  variables immediately.

`lib/__tests__/material-contract.test.ts` separately covers the dark, bright,
and high-detail wallpaper fixtures in both relevant themes and enforces a
minimum 4.5:1 token-pair critical-text diagnostic and 3:1 material-boundary
diagnostic.

## Required visual evidence status

No authenticated Preview or development session credentials were available in
this task environment. Consequently, the following captures and browser
accessibility/contrast measurements were **not captured**:

| Scenario | Settings desktop | Settings 390px | Dashboard desktop | Dashboard 390px | Critical text ratio |
| --- | --- | --- | --- | --- | --- |
| Dark wallpaper | Not captured | Not captured | Not captured | Not captured | Not measured |
| Bright wallpaper | Not captured | Not captured | Not captured | Not captured | Not measured |
| High-detail wallpaper | Not captured | Not captured | Not captured | Not captured | Not measured |
| Light mode | Not captured | Not captured | Not captured | Not captured | Not measured |
| Dark mode | Not captured | Not captured | Not captured | Not captured | Not measured |

The material-stress release gate remains **OPEN** until an authenticated browser
session captures each matrix cell and records measured title, body, and button
text ratios. Any measured value below 4.5:1 is a material-gate failure.
