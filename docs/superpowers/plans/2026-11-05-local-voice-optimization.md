# Novo 0.2.17: measured local voice optimization

Spec: user request of 2026-11-05 in this chat. Base: PR #41, `5a98630`.

## Constraints

Reuse the existing microphone, guarded process runner, dictation draft, desktop intentions, Twin and local SAPI reader. No action from partial speech; Send stays manual. Keep confidence filters, memory guard, account/cancellation checks, privacy and continuous listening off. No merge or production release. Physical results require actual user speech/hearing; synthetic references are separate. Install only a concrete authorized candidate with rollback verified first.

### Task 1: instrument the existing pipeline

Read all runner callers and voice event consumers. Write failing tests for bounded diagnostics and timing parsing. Add opt-in process diagnostics without changing normal callers; capture resource validation, microphone preparation/capture/endpoint, VAD, model load, encode/decode/process and draft-delivery timings. Persist only bounded numeric/status metrics, never audio/transcription/provider stderr. Preserve cancellation and error cleanup. Verify native and frontend regressions/build.

Expected: timing records distinguish measured/unknown fields, silence and cancellation do not deliver a draft, diagnostics cannot expose stderr or text, ordinary process callers retain behavior.

### Task 2: reproducible benchmark and hardware comparison

Extend the existing calibration instrument with repeated new-process runs (first-use vs OS-cache warm), same-process reuse where the pinned engine supports it, selectable threads/context/VAD and stage parsing. Self-check input/output metrics and resource bounds. Inventory actual CPU/GPU/RAM and engine features. Consult official sources through /browse. Compare only pinned, hash-verified lightweight resources; no heavyweight default installation. Synthetic ES/EN short/long speech and deterministic noise/silence are controls, not evidence of Dominican speech accuracy.

Expected: per-run timings, CPU time/utilization, working set/system floor, WER/intention errors and false recognitions; no fabricated disk-cold, resident-warm, power or physical measurements.

### Task 3: select changes from measurements

Keep production recognition settings unless a measured improvement also preserves reliability. Compare quantization, threads, available acceleration, bounded context, incremental recognition costs and Silero padding/endpoints. Only implement justified changes, with red/green tests. Document an optional hybrid design with separate consent if local hardware misses the experimental three-second target. Do not invoke a paid service or transmit audio.

Expected: explicit before/after with sample provenance and remaining limits; incremental hypotheses never authorize actions.

### Task 4: candidate and physical acceptance

Include pending reader fix `2d85284`. Verify local build, checksums and a rollback of the installed `c64098a` candidate. Present the concrete candidate and obtain installation authorization. Then test user-controlled microphone → draft → Send → Codex action → actual Twin context → audible reply; measure physical stop and UI responsiveness. Do not substitute synthetic audio or direct API calls for this circuit.

Expected: installed hash and human-confirmed/observed outcomes, or explicit pending/failed steps. No claim of physical success without user participation.

### Task 5: review and record

Run the relevant suites/build once changes settle, retain sanitized benchmark evidence, update current capability/debt/log records and draft PR #41. Perform one fresh final code review as required by executing-plans. Keep PR draft, no production release. Remove temporary consented audio when comparisons finish, preserving installers/rollback and sanitized records.

## Review focus

No stderr/text/audio in timing logs; bounded parsing/output, memory/cancellation guard retained; failure and stale request never deliver drafts; no partial action; existing process callers unchanged; model/context tuning must not truncate long commands or manufacture names; timing labels and cold/warm claims match actual instrumentation; candidate authorization and physical evidence are not inferred.
