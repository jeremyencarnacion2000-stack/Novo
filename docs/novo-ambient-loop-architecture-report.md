# Novo ambient loop architecture report

Date: 2026-08-11

Created `docs/novo-ambient-loop-architecture.md` from the corrected continuous-reconciliation audit. The document freezes the existing implementation boundary and separates proven current paths from planned interfaces.

It covers:

- fast reconciliation versus slow cognitive learning;
- the planned canonical observation contract mapped to `NovoSignalLedger`, `BehavioralSignal`, `OutcomeEvent`, `Activity`, `RecommendedAction`, `ChecklistItem`, `CalendarEvent`, `TimeBlock`, and `Task`;
- verification, idempotency, ownership, entity-resolution, transaction, and policy tiers;
- AUTO / CONFIRM / DO NOT CHANGE rules, privacy/proactivity/threshold gates, Todoist-first sequencing, MCP same-engine routing, calendar constraints, background transport limits, and release blockers.

No production code, model, schema, migration, provider configuration, or external state changed. The source evidence does not establish live provider E2E, deployed scheduler delivery, or Preview behavior; the architecture explicitly does not claim them.

Validation: `git diff --check` passed for the new documentation.
