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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
