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

Implementation and native acceptance completed on the development branch. Frontend426/build pass; native278 pass4ignored; manual Windows/account/context probes passed as recorded in [evidence](../../engineering/2026-11-04-desktop-assistance-evidence.md). Independent review findings were reproduced and fixed with regression coverage. Physical microphone, visual acceptance, packaging/install and production publication remain outside the completed acceptance. Installed app remains0.2.16.
