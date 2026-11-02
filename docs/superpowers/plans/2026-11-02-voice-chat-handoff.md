# Voice dictation through the current conversation

The user asks to implement useful capabilities from the documented ecosystem. Reuse Novo's recorder, Whisper route, persistent composer and existing chat action/confirmation path. Leon's controlled actions and Pipecat's separated input pipeline are architectural references; no upstream code or runtime is imported.

The chat microphone currently invokes the separate voice executor, whose generic fallback can create a task from ordinary speech. In chat routes, deliver the transcript to the active composer instead. Append to the draft, retain attachments, and require manual Send. A conversation/account change or panel close cancels pending dictation. Other explicit command-panel behavior stays compatible. No microphone or AI request starts automatically.

Alternatives considered: adding Pipecat duplicates the recorder/runtime; adding local speech models needs hardware measurements; reusing the current capture path reaches the existing chat without either dependency. The user has delegated routine implementation choices and asked to proceed autonomously.

- [x] Reproduce missing transcript handoff and account cancellation with focused tests.
- [x] Deliver headless recorder output into the existing composer, preserving drafts/files and manual send; guard account and selection changes.
- [ ] Verify both ends, cancellation and existing command panel behavior; run lint and remote type/build/regression checks.
- [x] Refresh repository research with source evidence and document this adaptation separately from uninstalled engines.
- [ ] Publish and verify the production controls; distinguish simulated transcription tests from real microphone validation.

No new service, persistence, dependency, voice model, credential, or permission. The existing transcription service remains cloud-based and the broader standalone command-panel migration is separate work.
