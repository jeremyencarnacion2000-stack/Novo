# Novo UI cleanup QA

## Estado antes de implementar

- La auditoría está completa y los cambios propuestos son no destructivos.
- Se preservan rutas legacy y datos.
- La nueva navegación aún requiere implementación y pruebas de responsive/accessibility.

## Gates

- [ ] Desktop: Today/Cognitive/Chat/Activity visibles y activos.
- [ ] Mobile: misma taxonomía, sin overflow, targets táctiles adecuados.
- [ ] Light/dark: contraste y estados legibles.
- [ ] Keyboard: foco visible y menú accesible.
- [ ] Reduced motion: no loops ni transiciones continuas.
- [ ] Empty/loading/error: copy específico y recuperación.
- [ ] Legacy routes: accesibles por URL/command menu.
- [ ] No datos falsos ni métricas decorativas nuevas.
- [ ] Jest, TypeScript, lint, Prisma validate, E2E y build.

## Evidencia pendiente

La captura visual autenticada y el build local siguen siendo gates pendientes documentados en `docs/novo-launch-readiness.md`.

## Evidence refresh — 2026-08-04

- Desktop/mobile navigation consolidation implemented and linted.
- Legacy routes remain accessible; no data was deleted.
- Impeccable detector: no findings on changed UI files.
- Strict TypeScript and full Jest pass; production build remains pending because of the documented local heap/duration gate.

## Evidence refresh — remote Preview gate — 2026-08-04

- Preview deployment `novo-desktop-nfl0d0ksk.vercel.app` completed the full Vercel build: compile, TypeScript, page-data collection, 128/128 static pages, trace collection and serverless output.
- The initial Preview failure was fixed by moving the optional OpenRouter credential check from module import time to request time in `lib/openrouter.ts`; routes can now build when that provider is not configured.
- Stable routes added for `/activity` (owner-scoped latest run recovery) and `/chat` (canonical chat alias). Vercel route output lists both as dynamic routes.
- Browser evidence: `/landing`, `/activity` and `/cognitive` returned HTTP 200 in the Preview. `/landing` returned meaningful server-rendered copy, pricing, support and policy links; metadata reports canonical `https://productivitynovo.vercel.app/landing`.
- Responsive evidence captured in `docs/preview-routes-mobile.png`, `docs/preview-routes-tablet.png` and `docs/preview-routes-desktop.png` using the gstack browser at 375, 768 and 1280 widths.
- The unauthenticated `/chat` request is intentionally handled by the existing auth policy and resolves to the public landing experience; authenticated chat remains available at `/ai` and through the new alias.
