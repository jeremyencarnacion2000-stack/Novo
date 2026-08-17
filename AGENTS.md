# Novo repository guide

## Structure

- `app/`: Next.js App Router screens and authenticated API routes.
- `components/`, `hooks/`: React UI and client state.
- `lib/`: Prisma, auth, integrations, AI and cognitive-domain services.
- `prisma/schema.prisma`: PostgreSQL/Neon schema; create additive migrations in `prisma/migrations/`.
- `tests/` and `lib/**/__tests__/`: Jest tests.

## Commands

- `npm run lint`
- `node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc --noEmit --pretty false --incremental`
- `npm test -- --runInBand`
- `npm run build` (or `npm run vercel-build` in Vercel)

## Conventions and safety

- TypeScript, App Router route handlers, Prisma ownership filters on every user resource.
- Validate mutable API input with Zod; never trust model output without server validation.
- Do not expose secrets, tokens, raw private journal text, or provider errors to clients/logs.
- Make database changes additive and migrate through Prisma; add indexes with the query that needs them.
- External writes require explicit user confirmation, idempotency, audit logging, and a safe retry path.
- Avoid speculative modules and preserve existing user data/flows.

## Done

Run the relevant checks, verify responsive/auth/error states, and distinguish pre-existing test failures from regressions.
