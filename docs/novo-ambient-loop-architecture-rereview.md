# Novo ambient loop architecture rereview

Date: 2026-08-11. Scope: corrected `docs/novo-ambient-loop-architecture.md` only.

**PASS.** All four required corrections are explicit:

1. A provider connection authorizes reads/projection only; Novo-to-provider writes are **CONFIRM** actions through a durable external-write boundary.
2. Delivery deduplication is separated from ordering; no-revision snapshots require an identified serialized sync run, and `receivedAt` cannot order state.
3. First-import bootstrap is confined to a verified, user-authorized bounded snapshot; missing webhook/delta mappings remain quarantined no-ops.
4. The complete identity includes owner, provider, owned connection/account, entity type, and source entity ID, with separate source-event/delivery identity.

The new contract remains explicitly planned. No schema/code is introduced, and the Todoist, Calendar, MCP, privacy, ownership, verification, and fast/slow-loop limits remain intact. No new material issue found.
