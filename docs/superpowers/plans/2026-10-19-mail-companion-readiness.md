# Novo mail and Companion readiness

User instruction: finish the approved active-assistant design inline, extend Gmail to read complete messages and send well-written mail, and deploy ready changes. The user is away; settle routine implementation choices without new questions.

## Completion contract

1. Gmail searches the authorized user's mailbox for the current question, reads MIME bodies and relevant threads, and preserves reply identifiers. Mail content is untrusted reference data, never instructions. Normal messages are read completely; bounded oversized content is explicitly marked.
2. Sending uses the durable user-owned Google grant with refresh, works without a browser session, validates recipients/headers, and shows recipient, subject and complete body before approval. An owner-bound durable claim prevents repeated sends; uncertain outcomes are reconciled or blocked rather than replayed.
3. Trusted runtime skills cover correspondence, cross-source project follow-up, planning and verification. Claims remain grounded in actual capabilities and results.
4. Companion reports failed authentication/context synchronization honestly. Preserve selected folders, existing data and credentials. Never bypass authorization or invent a successful connection.
5. Run focused tests, broader regression checks, lint/type checks and release build. Publish GitHub/Vercel changes under the user's standing deployment authorization after checks. Record any external consent/credential blocker precisely.

## Execution ledger

- Baseline: branch `codex/gmail-mailbox-auth`, commit `ec8567c`; existing unrelated changes in `notebooklm-mcp` and `prisma/migration-drafts/` remain untouched.
- Ruling: reuse this checkout and installed dependencies because the user chose inline execution and disk space is limited; no second dependency tree.
- Evidence: `getGmailContextForUser` intentionally discards bodies; sending prechecks an expiring access token and then resolves browser-session authentication. These prevent the requested full-context/background behavior.
- [ ] Mail read/search/thread capability and tests.
- [ ] Durable, reviewed mail delivery and tests.
- [ ] Runtime skills and chat integration.
- [ ] Companion authentication/context status investigation and repair.
- [ ] Regression verification, review and release.
