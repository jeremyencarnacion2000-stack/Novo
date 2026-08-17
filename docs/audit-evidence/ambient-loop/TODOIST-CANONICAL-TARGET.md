# Todoist canonical internal target

`ChecklistItem` is the canonical target for the first deterministic Todoist link.

**Why:** it is the existing user-owned task entity used by Today, task completion,
and the cognitive engine. The adapter verifies ownership by `(userId, id)` and does
not infer a relationship from title or similarity.

**Completion path:** a linked Todoist task is verified server-side and persisted as
an `ExternalEntityMapping` plus `ExternalEntityBaseline`; future reconciliation may
update the owned ChecklistItem through the ambient reconciliation boundary.

**Outcome path:** completion remains downstream of the existing ChecklistItem /
OutcomeEvent lifecycle. This checkpoint intentionally does not start the runner or
create OutcomeEvents.

**Recommendation impact:** the existing recommendation and Today queries continue
to consume ChecklistItems; linking establishes provenance without silently replacing
an existing action.
