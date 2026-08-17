# Novo Phase 2 Blocker Remediation and Release Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Certify Novo Phase 2 by repairing the clean migration path, protecting isolated E2E, validating a Preview build, and resolving the wallpaper-material, mobile-overlay, and Workout-critical-path blockers without changing Cognitive or starting Phase 3.

**Architecture:** Preserve migration history already recorded in production: insert one idempotent, additive schema bridge before the migration that assumes a Twin table, rather than editing an applied migration checksum. Centralize wallpaper readability in a small material-contract calculation consumed by the settings provider and the actual shell/card components. Coordinate mobile transient UI through one overlay owner so bottom navigation stays primary and secondary utilities cannot visually compete with modal or keyboard states.

**Tech Stack:** Next.js App Router, React/TypeScript, Prisma/PostgreSQL/Neon, Jest + Testing Library, CSS custom properties, Vercel Preview.

## Global Constraints

- Do not redesign Cognitive, add features, or begin Phase 3 identity work.
- Do not run `prisma db push` as migration certification; only use a disposable database for clean-chain verification.
- Do not edit a migration already recorded in production; its checksum must remain stable.
- Any migration SQL must be additive and idempotent (`IF NOT EXISTS` / guarded foreign keys and indexes); no production data is deleted or rewritten.
- E2E may reset only a distinct test database when `NOVO_ISOLATED_E2E=true`; production URL overlap must fail closed.
- Material has exactly three named surfaces: Canvas, Context Glass, and Focus Surface. Blur may enhance a surface but never be its only contrast guarantee.
- Critical normal-size text must measure at least WCAG AA 4.5:1; large text and non-text boundaries must measure at least 3:1.
- Mobile bottom navigation remains primary. Secondary utilities must not be visible above a modal, sheet, or software keyboard, and must respect safe area at 320, 360, 390, 412, and 430 CSS px.
- Workout is Option B unless the navigation audit proves it is in the critical journey: it remains available under More/Labs/legacy, not primary navigation; do not redesign it.
- Do not call Phase 2 PASS, deploy to production, or start Phase 3 until every exit-gate command and Preview capture in this plan passes.

---

## File Structure

- `prisma/migrations/20260801115000_add_cognitive_twin_schema_bridge/migration.sql` — backfilled, additive bridge that creates the tables required by the next historical migration on a clean database while doing nothing to an already-deployed schema.
- `scripts/verify-clean-migration-chain.mjs` — runs deploy/status/validate only against an explicitly named disposable PostgreSQL database and prints no URL secrets.
- `scripts/validate-isolated-e2e-environment.mjs` — validates test-URL presence, distinct identity, branch marker, and opt-in reset before any E2E mutation.
- `scripts/__tests__/verify-clean-migration-chain.test.mjs` and `scripts/__tests__/validate-isolated-e2e-environment.test.mjs` — unit contracts for the two release guards.
- `lib/material-contract.ts` — deterministic conversion of user appearance preferences into the three safe material CSS values and contrast diagnostics.
- `lib/__tests__/material-contract.test.ts` — contrast-floor and wallpaper stress-case tests.
- `lib/settings-context.tsx` — exposes the contract result and writes only its CSS custom properties; it remains the source of persisted appearance preferences.
- `app/globals.css` — consumes the three material variables and removes conflicting wallpaper/card/sidebar overrides.
- `components/settings/settings-personalization.tsx` — previews the actual Context Glass and Focus Surface on the currently selected Canvas, using the same components and variables as the product.
- `components/ui/card.tsx`, `components/ui/GlassSurface.tsx` — map to Focus Surface and Context Glass respectively without local blur overrides.
- `components/mobile-overlay-provider.tsx` — owns the exclusive mobile overlay state and browser-back close behavior.
- `components/dashboard-shell.tsx`, `components/mobile-nav.tsx`, `components/mobile-section-drawer.tsx`, `components/ai/GeminiLiveOrb.tsx`, `components/music/floating-music-widget.tsx`, `app/client-layout.tsx` — consume the overlay state and obey the single-primary-layer policy.
- `components/__tests__/mobile-overlay-policy.test.tsx` — viewports, safe area, modal/sheet/keyboard suppression, and Back behavior.
- `docs/audit-evidence/phase2/WORKOUT-DECISION.md` — records the Option B scope decision and all route/command entries that still reach Workout.
- `docs/audit-evidence/phase2/PHASE2-RELEASE-GATES.md` — final command output summaries, source-safe screenshots, Preview URL/statuses, and a strict PASS/NOT PASS verdict.

### Task 1: Establish a non-destructive release-gate baseline

**Files:**
- Create: `docs/audit-evidence/phase2/PHASE2-RELEASE-GATES.md`
- Modify: none
- Test: command evidence only

**Interfaces:**
- Consumes: current migration `20260801120000_remove_uncalibrated_twin_bootstrap`, Phase 1 report, and the repository’s configured Prisma schema.
- Produces: an evidence document with one row per release gate and an initial `OPEN` status; later tasks may only change a row to `PASS` with its command output and timestamp.

- [ ] **Step 1: Record the observed baseline without exposing connection strings**

Create the evidence table with these exact rows: `clean migration chain`, `isolated E2E environment`, `isolated E2E lifecycle`, `production build`, `Preview deployment`, `material stress`, `mobile overlays`, `Workout decision`, `Cognitive regression`, `final diff check`. Set the first five to `OPEN`; record the known clean-chain failure as `P3018 / 42P01 at 20260801120000_remove_uncalibrated_twin_bootstrap` and the Phase 1 result as the source.

- [ ] **Step 2: Capture read-only migration history**

Run:

```powershell
npx prisma migrate status --schema prisma/schema.prisma
npx prisma validate --schema prisma/schema.prisma
git diff --check
```

Record exit codes and redact database hosts, usernames, and query strings. Do not treat the first command as a clean-chain certificate; it only establishes the current configured-database status.

- [ ] **Step 3: Verify the historical assumption**

Run:

```powershell
rg -l -i 'cognitive_twin_records|behavioral_signals|twin_evolution_logs|twin_snapshots' prisma/migrations -g migration.sql
Get-Content -Raw prisma/migrations/20260801120000_remove_uncalibrated_twin_bootstrap/migration.sql
```

Confirm in the evidence document that no earlier migration creates `cognitive_twin_records`, while the failing migration alters it. This is the specific condition the bridge must repair.

- [ ] **Step 4: Commit the evidence scaffold only**

```powershell
git add docs/audit-evidence/phase2/PHASE2-RELEASE-GATES.md
git commit -m "docs: add phase 2 release gate ledger"
```

### Task 2: Repair the clean migration chain without changing deployed migration checksums

**Files:**
- Create: `prisma/migrations/20260801115000_add_cognitive_twin_schema_bridge/migration.sql`
- Create: `scripts/verify-clean-migration-chain.mjs`
- Create: `scripts/__tests__/verify-clean-migration-chain.test.mjs`
- Modify: `package.json` (add a `verify:migrations:clean` script only)
- Test: `scripts/__tests__/verify-clean-migration-chain.test.mjs`

**Interfaces:**
- Consumes: `DATABASE_URL_CLEAN_MIGRATION` (a disposable, empty PostgreSQL database URL) and `NOVO_CLEAN_MIGRATION_DB=true`.
- Produces: `verifyCleanMigrationChain({ databaseUrl, confirmed }): Promise<{ deploy: number; status: number; validate: number }>`; it rejects unconfirmed, non-local/non-disposable targets before invoking Prisma.

- [ ] **Step 1: Write the failing guard tests**

Add tests that assert all three cases:

```js
expect(() => assertCleanMigrationTarget({ confirmed: false, databaseUrl: 'postgresql://localhost/novo_clean_migration' }))
  .toThrow('NOVO_CLEAN_MIGRATION_DB=true is required');
expect(() => assertCleanMigrationTarget({ confirmed: true, databaseUrl: 'postgresql://prod.example/novo' }))
  .toThrow('must be local or explicitly disposable');
expect(assertCleanMigrationTarget({ confirmed: true, databaseUrl: 'postgresql://localhost/novo_clean_migration' }))
  .toEqual({ databaseName: 'novo_clean_migration' });
```

Run `node --test scripts/__tests__/verify-clean-migration-chain.test.mjs`; expect the import to fail until the guard exists.

- [ ] **Step 2: Generate and inspect the bridge schema, then write only additive SQL**

Use the checked-in Prisma schema and the existing migration directory to generate a review artifact:

```powershell
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script | Set-Content -Encoding utf8 .tmp-cognitive-bridge.sql
```

From that artifact, copy only the `CREATE TABLE`, `CREATE INDEX`, and foreign-key statements needed for `cognitive_twin_records`, `behavioral_signals`, `twin_evolution_logs`, and `twin_snapshots`; use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` for each foreign key. The bridge must define the exact current Prisma columns, defaults, unique constraints, and indexes, including the `users(id)` foreign key and the cascade relationships from dependent Twin tables. Do not copy any `DROP`, `ALTER ... DROP`, data update, or unrelated model statement from the diff.

Place it in `20260801115000_add_cognitive_twin_schema_bridge`, lexically before the existing failing `20260801120000` migration. Do not modify either historical migration: production checksum compatibility is the acceptance criterion.

- [ ] **Step 3: Implement the disposable-database verifier**

Implement `assertCleanMigrationTarget` by parsing with `new URL(databaseUrl)`, requiring `NOVO_CLEAN_MIGRATION_DB === 'true'`, a database name containing `clean` or `disposable`, and either `localhost`/`127.0.0.1`/`::1` or `NOVO_CLEAN_MIGRATION_REMOTE_DISPOSABLE === 'true'`. Implement `verifyCleanMigrationChain` with `spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], { env: { ...process.env, DATABASE_URL: databaseUrl } })`, then the equivalent `migrate status` and `validate` invocations. Throw on any nonzero exit; print only command names and exit codes.

Add this package script:

```json
"verify:migrations:clean": "node scripts/verify-clean-migration-chain.mjs"
```

- [ ] **Step 4: Run the focused tests and clean-chain certificate**

Run:

```powershell
node --test scripts/__tests__/verify-clean-migration-chain.test.mjs
$env:NOVO_CLEAN_MIGRATION_DB='true'; $env:DATABASE_URL_CLEAN_MIGRATION='<disposable-empty-db-url>'; npm run verify:migrations:clean
```

Create the disposable database through the approved non-production test environment, run the command, then drop only that named disposable database after preserving the output. Record `migrate deploy`, `migrate status`, and `prisma validate` as `PASS` only when all exit with code 0.

- [ ] **Step 5: Check production compatibility without touching production data**

Against the configured production-compatible schema connection, run only `npx prisma migrate status --schema prisma/schema.prisma`. Confirm that the existing migration checksums are unchanged and that the new bridge is safe to apply to an existing schema because all creates are idempotent. Do not run reset, seed, or custom SQL on that database.

- [ ] **Step 6: Commit the migration repair and verifier**

```powershell
git add prisma/migrations/20260801115000_add_cognitive_twin_schema_bridge scripts/verify-clean-migration-chain.mjs scripts/__tests__/verify-clean-migration-chain.test.mjs package.json
git commit -m "fix: bridge cognitive twin migration chain"
```

### Task 3: Make isolated E2E fail closed and certify the complete learning loop

**Files:**
- Create: `scripts/validate-isolated-e2e-environment.mjs`
- Create: `scripts/__tests__/validate-isolated-e2e-environment.test.mjs`
- Modify: `package.json` (add `validate:e2e:isolated` and route the existing isolated E2E command through it)
- Modify: existing isolated E2E setup/configuration file discovered by `rg -n "NOVO_ISOLATED_E2E|DATABASE_URL_TEST|reset" tests scripts lib`
- Test: focused guard tests and the existing isolated E2E suite

**Interfaces:**
- Consumes: `DATABASE_URL_TEST`, `DATABASE_URL`, `NOVO_ISOLATED_E2E=true`, and `NOVO_TEST_DB_IDENTITY`.
- Produces: `assertIsolatedE2EEnvironment(env): { testDatabase: string; productionOverlap: false }`; any reset helper must call it before opening a Prisma connection.

- [ ] **Step 1: Write the failing isolation cases**

Add tests for these exact inputs:

```js
expect(() => assertIsolatedE2EEnvironment({ DATABASE_URL_TEST: '', NOVO_ISOLATED_E2E: 'true' }))
  .toThrow('DATABASE_URL_TEST is required');
expect(() => assertIsolatedE2EEnvironment({ DATABASE_URL_TEST: 'postgresql://x/novo_prod', DATABASE_URL: 'postgresql://x/novo_prod', NOVO_ISOLATED_E2E: 'true', NOVO_TEST_DB_IDENTITY: 'novo-test' }))
  .toThrow('overlaps DATABASE_URL');
expect(() => assertIsolatedE2EEnvironment({ DATABASE_URL_TEST: 'postgresql://x/novo_test_branch', DATABASE_URL: 'postgresql://x/novo_prod', NOVO_ISOLATED_E2E: 'false', NOVO_TEST_DB_IDENTITY: 'novo-test' }))
  .toThrow('NOVO_ISOLATED_E2E=true is required');
expect(assertIsolatedE2EEnvironment({ DATABASE_URL_TEST: 'postgresql://x/novo_test_branch', DATABASE_URL: 'postgresql://x/novo_prod', NOVO_ISOLATED_E2E: 'true', NOVO_TEST_DB_IDENTITY: 'novo-test' }).productionOverlap)
  .toBe(false);
```

- [ ] **Step 2: Implement the shared guard and wire it before destructive work**

Parse URLs, compare normalized origin plus pathname, reject an empty test URL, reject equality to `DATABASE_URL`, require a test/disposable marker in both the database name and `NOVO_TEST_DB_IDENTITY`, and require the literal opt-in. Export the function from the script. In the existing seed/reset/E2E bootstrap, call it before `prisma migrate reset`, fixture writes, OAuth/MCP writes, and Calendar writes. Keep provider tokens and URLs out of exceptions and logs.

- [ ] **Step 3: Validate the repaired Neon test credentials**

Run:

```powershell
$env:NOVO_ISOLATED_E2E='true'; $env:DATABASE_URL_TEST='<Neon-test-branch-url>'; $env:NOVO_TEST_DB_IDENTITY='<test-branch-name>'; npm run validate:e2e:isolated
```

The value must point to a test branch distinct from production. If Neon rejects authentication or a distinct branch credential is not available, leave the gate `BLOCKED — test-branch credential required`; do not substitute production, a shared personal database, or `db push`.

- [ ] **Step 4: Run the full isolated lifecycle suite**

Run the existing E2E command only after Step 3 passes. Its assertions must demonstrate, for User A: `goal → signal → interpretation → pattern → correction → changed recommendation → acceptance → action → verification → outcome → learning → changed subsequent recommendation`; for User B: no User A record/recommendation leakage. Assert replaying the same MCP payload and the same Calendar payload does not create duplicate effects, and assert Activity polling/SSE recovery reaches a final consistent state after a transient failure.

Add missing assertions to the existing suite in the test’s established style rather than inventing a second lifecycle implementation. Persist no real provider credentials in fixtures.

- [ ] **Step 5: Record the only valid result and commit**

Run:

```powershell
node --test scripts/__tests__/validate-isolated-e2e-environment.test.mjs
npm run validate:e2e:isolated
npm test -- --runInBand <isolated-e2e-test-path>
```

Record all three outputs. Commit only after they pass:

```powershell
git add scripts/validate-isolated-e2e-environment.mjs scripts/__tests__/validate-isolated-e2e-environment.test.mjs package.json tests lib
git commit -m "test: guard isolated Novo lifecycle E2E"
```

### Task 4: Define and enforce the three-surface material contract

**Files:**
- Create: `lib/material-contract.ts`
- Create: `lib/__tests__/material-contract.test.ts`
- Modify: `lib/settings-context.tsx`
- Modify: `app/globals.css`
- Modify: `components/ui/card.tsx`
- Modify: `components/ui/GlassSurface.tsx`
- Test: `lib/__tests__/material-contract.test.ts`, existing wallpaper/card/sidebar tests

**Interfaces:**
- Consumes: `AppearanceSettings` fields `backgroundImage`, `backgroundDimness`, `backgroundBlur`, `autoContrast`, `glassOpacity`, `glassBlur`, `cardOpacity`, `cardLiquidIntensity`, and theme.
- Produces: `resolveMaterialContract(input): { canvas: MaterialSurface; contextGlass: MaterialSurface; focusSurface: MaterialSurface; diagnostics: { criticalTextContrast: number; boundaryContrast: number } }`, where each `MaterialSurface` supplies CSS-safe `background`, `backdropFilter`, `border`, and `boxShadow` strings.

- [ ] **Step 1: Write wallpaper and contrast-floor tests first**

Define five inputs: dark wallpaper/dark theme, bright wallpaper/light theme, high-detail wallpaper/light theme, no wallpaper/light theme, and no wallpaper/dark theme. Test these invariants:

```ts
expect(contract.diagnostics.criticalTextContrast).toBeGreaterThanOrEqual(4.5);
expect(contract.diagnostics.boundaryContrast).toBeGreaterThanOrEqual(3);
expect(contract.focusSurface.background).not.toMatch(/^transparent$/);
expect(contract.contextGlass.background).not.toMatch(/^transparent$/);
expect(contract.focusSurface.backdropFilter).toContain('blur(');
```

Also prove that a user-set card opacity of `0` and blur of `0` cannot make either Context Glass or Focus Surface transparent when a wallpaper is active.

- [ ] **Step 2: Implement the pure contract with local fill floors**

Implement luminance/contrast helpers for hex RGB tokens and select theme foreground/background pairs. Clamp Context Glass alpha to at least `0.68` light / `0.56` dark with wallpaper, and Focus Surface alpha to at least `0.78` light / `0.68` dark with wallpaper. Clamp Context Glass blur to `12px` and Focus Surface blur to `18px` when wallpaper exists; retain user settings only above those floors. Canvas owns wallpaper blur/dimness. When `autoContrast` is enabled, add Canvas dimness/blur but never lower the local surface floors. Return numeric diagnostics from the resulting token pairs; do not pretend to sample arbitrary image pixels.

- [ ] **Step 3: Make Settings and product surfaces use the single contract**

Replace direct calculation of `--wallpaper-card-*`, sidebar aliases, and global opacity hacks in `lib/settings-context.tsx` with one call to `resolveMaterialContract`. Write only these variables to the document: `--novo-canvas-*`, `--novo-context-*`, and `--novo-focus-*`. In CSS, map `body`/wallpaper layers to Canvas, navigation/sidebar/secondary regions to Context Glass, and cards/dialog bodies/primary action regions to Focus Surface. Remove selectors that override a surface’s `background` or `backdrop-filter` after the variables are applied.

Ensure `Card` applies `novo-focus-surface` and `GlassSurface` applies `novo-context-glass`; neither component receives a competing inline wallpaper opacity or blur value.

- [ ] **Step 4: Run unit and regression tests**

Run:

```powershell
npm test -- --runInBand lib/__tests__/material-contract.test.ts lib/__tests__/appearance-transition.test.ts components/__tests__/dashboard-wallpaper-layer.test.ts components/ui/__tests__/sidebar-material.test.ts components/ui/__tests__/dashboard-card-material.test.tsx app/globals.test.ts
```

Expected: all pass; snapshots/assertions must name only Canvas, Context Glass, and Focus Surface, never a fourth surface category.

- [ ] **Step 5: Commit the material contract**

```powershell
git add lib/material-contract.ts lib/__tests__/material-contract.test.ts lib/settings-context.tsx app/globals.css components/ui/card.tsx components/ui/GlassSurface.tsx
git commit -m "fix: enforce wallpaper material contrast contract"
```

### Task 5: Show the actual material behavior in Settings and capture stress evidence

**Files:**
- Modify: `components/settings/settings-personalization.tsx`
- Modify: `components/settings/__tests__/settings-personalization.test.tsx` (or create it if absent)
- Create: `docs/audit-evidence/phase2/material/README.md`
- Test: personalization and material tests

**Interfaces:**
- Consumes: the contract published by `SettingsContext` and the selected `backgroundImage`.
- Produces: a preview containing the same `GlassSurface` and `Card` components used in the dashboard; slider input updates the shared settings state in the same render turn.

- [ ] **Step 1: Write the failing real-surface preview test**

Render personalization with a selected wallpaper, set card opacity/blur sliders, and assert the preview contains the actual `novo-context-glass` and `novo-focus-surface` class names. Fire an `input` event on both sliders and assert the corresponding document CSS variable changes without saving/reloading. Assert the preview is not a disconnected screenshot, mock canvas, or duplicate local style object.

- [ ] **Step 2: Replace the decorative preview with actual components**

Render the selected wallpaper within the preview Canvas and place `GlassSurface` plus `Card` inside it. Reuse the settings context values rather than duplicating CSS values in the settings component. Keep sliders controlled by the persisted appearance settings so each `onChange` updates preview and product surfaces immediately; preserve existing save/persistence behavior.

- [ ] **Step 3: Capture required visual evidence**

With an authenticated Preview/dev session, capture desktop and 390px Settings plus Dashboard for: dark wallpaper, bright wallpaper, high-detail wallpaper, light mode, and dark mode. Inspect critical title/body/button text with the browser accessibility/contrast tool and record the measured ratios in `docs/audit-evidence/phase2/material/README.md`. A failure below 4.5:1 is a material-gate failure, not a subjective exception.

- [ ] **Step 4: Run and commit**

```powershell
npm test -- --runInBand components/settings/__tests__/settings-personalization.test.tsx lib/__tests__/material-contract.test.ts
git add components/settings/settings-personalization.tsx components/settings/__tests__/settings-personalization.test.tsx docs/audit-evidence/phase2/material
git commit -m "test: preview Novo material surfaces in settings"
```

### Task 6: Coordinate mobile overlays behind one primary navigation layer

**Files:**
- Create: `components/mobile-overlay-provider.tsx`
- Create: `components/__tests__/mobile-overlay-policy.test.tsx`
- Modify: `components/dashboard-shell.tsx`
- Modify: `components/mobile-nav.tsx`
- Modify: `components/mobile-section-drawer.tsx`
- Modify: `components/ai/GeminiLiveOrb.tsx`
- Modify: `components/music/floating-music-widget.tsx`
- Modify: `app/client-layout.tsx`
- Test: existing mobile navigation tests and new policy test

**Interfaces:**
- Produces: `useMobileOverlay(): { activeOverlay: 'none' | 'navigation' | 'voice' | 'utility'; keyboardOpen: boolean; openOverlay(kind): void; closeOverlay(): void; setKeyboardOpen(open): void; suppressSecondary: boolean }`.
- Consumes: mobile nav drawer, voice utility, music utility, modal/sheet state, and `visualViewport` keyboard state.

- [ ] **Step 1: Write failing exclusive-overlay and Back tests**

At 390px, open the More/navigation sheet and assert the voice and music utilities are not rendered or are `aria-hidden=true`. Then open a modal/sheet and assert secondary utilities and background click targets are absent from the accessibility tree. Simulate a `popstate` event while the overlay is open; assert `closeOverlay` runs and the route does not change. Repeat key layout assertions at 320, 360, 412, and 430px, including a `padding-bottom: env(safe-area-inset-bottom)` assertion on the primary nav.

- [ ] **Step 2: Implement the provider and exclusive ownership**

Create the provider near `DashboardShell`; only one `activeOverlay` value may be non-`none`. `openOverlay` replaces an existing secondary overlay, `closeOverlay` clears it, and the provider registers a `popstate` listener that closes an active overlay before route navigation. Track keyboard state using `visualViewport` resize and focused editable controls. Derive `suppressSecondary` when any overlay, modal/sheet, or keyboard is active.

- [ ] **Step 3: Connect all secondary utilities**

Have the mobile FAB open `navigation`. Put voice/time/utilities behind the one contextual trigger/sheet rather than fixed independent z-indexes. Make `GeminiLiveOrb` and the floating music widget return `null` on mobile while `suppressSecondary` is true, and never render them above an active modal/sheet. Use the provider’s safe-area CSS variables rather than hard-coded `bottom-40` offsets. Keep 44x44 minimum targets and preserve desktop behavior.

- [ ] **Step 4: Run mobile policy tests and manual interaction checks**

Run:

```powershell
npm test -- --runInBand components/__tests__/mobile-nav.test.tsx components/__tests__/mobile-overlay-policy.test.tsx
```

Manually verify on 320, 360, 390, 412, and 430px: opening and closing the primary sheet, tapping a modal action, focusing an input, keyboard appearance, and Android/browser Back. Capture before/after 390px evidence only after the tests pass.

- [ ] **Step 5: Commit the overlay policy**

```powershell
git add components/mobile-overlay-provider.tsx components/__tests__/mobile-overlay-policy.test.tsx components/dashboard-shell.tsx components/mobile-nav.tsx components/mobile-section-drawer.tsx components/ai/GeminiLiveOrb.tsx components/music/floating-music-widget.tsx app/client-layout.tsx
git commit -m "fix: coordinate Novo mobile overlays"
```

### Task 7: Formalize Workout as non-critical without redesigning it

**Files:**
- Create: `docs/audit-evidence/phase2/WORKOUT-DECISION.md`
- Modify: `components/mobile-section-drawer.tsx` only if Workout is currently a primary action
- Modify: `components/app-sidebar.tsx` only if Workout is currently in the primary group
- Modify: `components/quick-actions.tsx` only if it promotes Workout as a critical quick action
- Test: existing navigation/routine mobile tests

**Interfaces:**
- Consumes: route `/routines`, command palette entries, desktop navigation, mobile navigation, More drawer, and quick actions.
- Produces: a documented Option B decision: Workout is reachable from More/Labs/legacy and command search, but not desktop/mobile primary navigation or critical quick actions.

- [ ] **Step 1: Audit every Workout entry point**

Run:

```powershell
rg -n "(/routines|Workout|Rutina|Start Workout)" app components lib
```

List each result in the decision document as `primary`, `secondary`, or `legacy`. The Phase 1 critical journey is Dashboard, Today, Cognitive, Chat, and Activity; cite this boundary in the rationale.

- [ ] **Step 2: Write the navigation test before moving any primary entry**

Add/extend a test that verifies mobile primary nav contains Home, Cognitive, Chat, and Activity, but not Workout; verifies a More/legacy route can still navigate to `/routines`; and verifies the desktop primary group does not place Workout alongside Dashboard/Today/Cognitive/Chat/Activity.

- [ ] **Step 3: Apply Option B with the smallest navigation change**

If the audit finds Workout primary, move only its existing entry to the current More/Labs/legacy collection. Do not change routine UI, dialogs, exercise cards, tabs, or data behavior. If it is already secondary, make no UI change and document the verified route instead.

- [ ] **Step 4: Validate and commit**

Run:

```powershell
npm test -- --runInBand components/__tests__/mobile-nav.test.tsx components/routines/__tests__/routine-mobile-layout.test.tsx
git add docs/audit-evidence/phase2/WORKOUT-DECISION.md components/mobile-section-drawer.tsx components/app-sidebar.tsx components/quick-actions.tsx components/__tests__/mobile-nav.test.tsx
git commit -m "docs: classify workout outside critical journey"
```

### Task 8: Certify build, Preview, and final Phase 2 exit gate

**Files:**
- Modify: `docs/audit-evidence/phase2/PHASE2-RELEASE-GATES.md`
- Create: `docs/audit-evidence/phase2/preview/README.md`
- Test: repository commands plus Preview HTTP checks

**Interfaces:**
- Consumes: passing prior tasks, valid test-branch credentials, and authorized Vercel Preview environment.
- Produces: a strict Phase 2 report marked `PASS` only if every required command and capture passed, otherwise `NOT PASS` with the exact unmet gate.

- [ ] **Step 1: Run local static verification**

Run:

```powershell
node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc --noEmit --pretty false --incremental
npm run lint
npm test -- --runInBand
git diff --check
```

Record the exact totals and separate pre-existing warnings from errors. Any new error, failed test, or diff whitespace issue leaves the final verdict `NOT PASS`.

- [ ] **Step 2: Run the production build or explicitly escalate to Preview certification**

Run:

```powershell
npm run build
```

If it completes, preserve the exit code and confirm `.next/BUILD_ID` exists. If it exceeds the agreed local time/resource ceiling, record `LOCAL BUILD INCONCLUSIVE` rather than PASS and use the Vercel Preview build as the build certificate; do not silently omit this outcome.

- [ ] **Step 3: Deploy and validate Vercel Preview, never production**

Use the project’s approved Preview deployment command/environment. Confirm the deployment status reaches `READY`, capture the Next build log sections for TypeScript and static/dynamic route generation, and request these route statuses from the Preview URL: `/`, `/today`, `/cognitive`, `/chat`, `/activity`, `/routines`, and the authentication entry route. Record status codes and screenshots for desktop plus 390px material/overlay checks. Do not execute a production promote/deploy command.

- [ ] **Step 4: Complete the evidence ledger and determine the verdict**

Mark Phase 2 `PASS` only when each is backed by output: clean deploy/status/validate; valid isolated E2E credential plus complete lifecycle pass; local build pass or READY Preview build pass; stress-case material ratios; all five mobile widths; Workout Option B document; and a Cognitive smoke capture showing no regression. Otherwise mark `NOT PASS`, name the one or more missing gates, and stop.

- [ ] **Step 5: Commit the report only when evidence is complete**

```powershell
git add docs/audit-evidence/phase2
git commit -m "docs: record phase 2 release gate evidence"
```

## Self-Review

- Clean migration chain: Tasks 1–2 reproduce the P3018 root cause, bridge it before the failing migration without checksum mutation, and require deploy/status/validate on a disposable database.
- Isolated E2E: Task 3 requires credentials, rejects production overlap, protects resets, and covers every specified lifecycle/idempotency/recovery assertion.
- Production build and Preview: Task 8 requires either a local build pass or a READY Preview certificate and blocks production promotion.
- Material: Tasks 4–5 establish exactly three surfaces, enforce local-fill contrast floors, show real surfaces in Settings, and capture all five required wallpaper/theme cases.
- Mobile: Task 6 makes bottom nav primary, consolidates utilities, protects modal/sheet/keyboard states, uses safe areas, validates Back, and tests all required widths.
- Workout: Task 7 selects and documents Option B with the smallest possible navigation change.
- Scope: no task alters Cognitive product behavior or adds Phase 3 work.

Placeholder scan completed: no deferred implementation item is used as a completion criterion. Type names and functions are introduced before consumers use them.
