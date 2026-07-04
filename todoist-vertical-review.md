# Todoist vertical review — `80517b5`

## SPEC

**Verdict: BLOCK — one cursor-safety violation.**

- Bootstrap is baseline-only: it creates selected-scope active mappings, ignores pulled completions, and delegates no completion/learning work. Post-bootstrap active-task absence is ignored.
- Completion handling is explicit-only and goes through the ambient core with the owned user, connection, and provider-account identity. Scope comes from the loaded owned connection; callers cannot widen it.
- The run is claimed before pulling; normal safe dispositions (`projected`, `duplicate`, `stale`) permit final cursor advancement. Quarantine and projection/finalization failures retain the old cursor and release the run. No route, cron, plugin, schema, or migration wiring was added. The report accurately labels the durable production adapter as blocked.
- **Blocking:** the client silently drops malformed task and completion rows with `flatMap` instead of failing the pull. In particular, a `completed` activity with a missing/invalid `id`, `object_id`, or `event_date` is discarded; reconciliation then sees no unsafe result and advances the cursor to `fetchedAt`. That can permanently skip a real completion, contradicting the report's "malformed response ... fails the whole pull" and its fail-closed cursor claim. See `lib/cognitive-reconciliation/todoist-reconciliation-client.ts` (`rows.flatMap` and `events.flatMap`).

Required correction: reject the entire pull when a selected-project task row, or a completion-capable event row, lacks required valid fields (and add a test proving the cursor does not advance after that rejection).

## QUALITY

- Focused tests cover baseline suppression, explicit completion projection, replay, ownership/scope, pause, partial projection failure, final cursor failure, active absence, and bounded/truncated completion pulls.
- Missing regression coverage for malformed individual rows and active-task truncation. These omissions allowed the blocking fail-open behavior to pass.

## REMEDIATION UPDATE

**Resolved: PASS.** The former cursor-safety block is addressed. A selected-project task row now rejects the pull when malformed, and a completion-capable activity rejects it when its `id`, `object_id`, or `event_date` is invalid. The reconciliation service releases the claimed run and retains the existing cursor after that rejection.

Focused regression coverage verifies malformed active-task rows, malformed completion rows, and cursor retention after a provider rejection. The bounded active and completion pull safeguards remain unchanged.
