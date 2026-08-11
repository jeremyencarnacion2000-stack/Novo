# Task 5 report — Settings material preview and evidence scaffold

## Changed files

- `components/settings/settings-personalization.tsx` — adds a live Canvas,
  Context Glass, and Focus Surface preview built from the shared `GlassSurface`
  and `Card` components; card controls now have native label associations.
- `components/settings/__tests__/settings-personalization.test.tsx` — verifies
  selected-wallpaper propagation, the shared material class roles, and
  immediate root custom-property changes from native card slider input events.
- `docs/audit-evidence/phase2/material/README.md` — records the automated
  evidence and the outstanding authenticated visual-evidence matrix.

## Verification

Passed:

```text
npm test -- --runInBand components/settings/__tests__/settings-personalization.test.tsx lib/__tests__/material-contract.test.ts

Test Suites: 2 passed, 2 total
Tests:       9 passed, 9 total
```

Targeted ESLint and `git diff --check` also passed for the Task 5 paths.

## Visual evidence limitation

No authenticated Preview/dev-session credentials were available. No external
screenshots or accessibility-tool measurements were attempted; the material
stress gate remains OPEN pending desktop and 390px captures for all required
wallpaper and theme conditions.
