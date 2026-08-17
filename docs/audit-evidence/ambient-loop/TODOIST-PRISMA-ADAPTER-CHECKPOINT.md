# Todoist Ambient Prisma Adapter checkpoint

The server-only runner remains orchestration; `todoist-ambient-prisma-adapter.ts` owns Prisma persistence and receives provider discovery/verification as injected ports.

| Port | Production implementation | Durability |
|---|---|---|
| eligible connection | `IntegrationAccount` query scoped to Todoist, provider account, token and allowed sync status | DB filtered, fail-closed |
| ambient claim | `AmbientReconciliationClaim` unique lane key with conditional update and 5-minute lease | durable/recoverable; race certification needs PostgreSQL |
| cursor | `IntegrationAccount.syncCursor` scoped to connection; expected-cursor conditional advance | monotonic best-effort; stale-worker race needs PostgreSQL |
| mapping | `ExternalEntityMapping` scoped by user, connection, account, task entity and active status, then owned `Task` query | cross-user safe |
| baseline | `ExternalEntityBaseline` upsert through mapping with normalized state/hash | advances after durable completion boundary |
| transition identity | unique `AmbientReconciliationClaim` transition key | replay-safe across processes |
| completion bridge | runner calls `completeDurableTask`; it owns Task/Outcome/Replan transaction | no manual Outcome creation |

The provider adapter is intentionally not imported by the Prisma repository. A no-browser proof asserts the runner has no React/window/document/session-storage dependency. Production cron and deployment remain disabled pending disposable PostgreSQL concurrency and real Todoist evidence.
