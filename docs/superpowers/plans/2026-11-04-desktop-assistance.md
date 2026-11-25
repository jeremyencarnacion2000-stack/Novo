# Companion desktop assistance from 0.2.16

User specification: installed application catalog, configurable exclusions, separate opening/control/window-reading permissions, deterministic desktop intents, and «Novo, abre Visual Studio Code y continuemos con ClickHome» using existing authorized project context/Twin. Missing or ambiguous context must ask, never fabricate. Manual dictation uses the same Send path. No production publication.

## Task 1: Native catalog and permissions
- Discover registered Windows AppsFolder entries using a fixed, bounded, hidden Windows helper; only canonical EXE targets or packaged app identifiers are launchable. Keep paths/launch targets local and return opaque identifiers.
- Preserve known aliases; refresh catalog on demand. Default opening/control available with configurable exclusions; window-title reading remains opt-in and independently enforced. Recheck account and exclusions at execution, including legacy commands.
- Test parsing, permissions, corrupt settings, and unsupported targets. Verify actual installed catalog.

## Task 2: Desktop intent and project continuation
- Extend the existing desktop parser for installed names, «Novo» prefix, and one explicit project continuation. Resolve exact/ambiguous/missing apps without model calls.
- Execute native operations, then query authorized context once. With no exact project evidence, ask for its folder/context. With evidence, reuse the existing NovoChatController, Twin and conversation; never start a second orchestrator.
- Test failures, exclusions, ambiguity, cancellation and the manual-dictation → Send path.

## Task 3: Windows evidence and review
- Run Companion frontend/build/native checks and real Windows actions under the user's explicit test authorization. Record observed state; separate physical microphone acceptance from injected-transcript tests.
- Update capability/debt/log documents and obtain whole-change review. Do not publish or merge to production.

## Review focus
Permissions cannot be bypassed through legacy commands, stale handles, altered catalog identifiers or config corruption. No paths/argv enter the model; cancelled/account-switched work cannot execute late. Successful launch claims require observed windows; unknown ClickHome context produces a question.

## Verification record

Voice continuation from `d981ad6`: four independent human speech samples (including the installed button), one confirmed no-utterance control, and audible SAPI ES/EN plus installed chat playback confirmed by the user. Capture ordering and premature listening were reproduced and fixed in installed `c64098a`; explicit local language selection was added. That revision passed 432 frontend and 279 native tests. Later playback fix `2d85284` passes 433 frontend tests and build but is not installed. Original 0.2.16 installers and 21 rollback files match their SHA-256 records. Recognition acceptance and the physical combined circuit remain pending. See [calibration](../../engineering/2026-11-04-voice-calibration.md).

The implementation and Windows probes are on draft PR #41. Candidate 0.2.17 `c64098a` was built and installed with explicit authorization and verified 0.2.16 rollback; it is unsigned and not published. A fourth independent spoken sample from the installed button still failed fixed-Spanish recognition (7.9 s, 150.9 MiB). The user confirmed typed Codex opening/focus and audible manual chat playback, not the complete microphone/Twin circuit. A later frontend regression fix preserves manual speech across unrelated settings saves (red/green test, 433 frontend tests and build pass); it is not in the installed package. The app restarted successfully for language verification, but recovery of interrupted actions, visual acceptance and physical interruption latency remain unverified. Earlier capture cancellation was under 250 ms in six runs with one 10.5 s outlier. Keep PR #41 in draft; do not merge or publish. See [calibration](../../engineering/2026-11-04-voice-calibration.md).
