# Companion: bounded local dictation

Continuation of the approved «Novo: conversación por voz y control de apps» plan. Preserve 0.2.15 account authorization, visual approvals and cloud dictation consent. This delivery supplies native manual capture and the single whisper.cpp/Silero worker needed before wake-word calibration. No permanent listening before the approved physical pilot passes.

Global constraints: no microphone starts on installation or launch; one bounded request; local Spanish/English; no automatic cloud fallback; no late transcript across account/conversation/provider changes; no audio retained after a request; at least 512 MiB system memory stays available; fixed binaries/models/hashes/licenses. Reuse the guarded child process and existing composer; text must be reviewed before Send. No unrelated assistant framework.

## Task 1: Pin and prepare local speech resources

- Write a failing integrity test for truncated/tampered resources, then the minimum preparer using Node and Windows archive support.
- Pin whisper.cpp b5454 (v1.9.5 commit), multilingual tiny q5_1 and Silero 6.2.0. Download and verify their hashes; keep generated binaries out of Git. Include upstream license notices.
- Verify the downloaded CLI exposes the required flags without loading models or opening the microphone.
- Expected: integrity tests pass and every prepared file has the recorded hash.

## Task 2: Native bounded capture and transcription

- Write failing pure tests for WAV framing, silence, bounded output and uncertain transcription.
- Add a native Windows recording worker using the existing Windows dependency; maximum 20 seconds, explicit finish/cancel, lock/permission/context cancellation, memory guard and deletion of request files.
- Reuse the existing guarded process runner, fixed arguments and hashed resources. Emit only request-scoped status and final validated text.
- Expected: native unit tests pass; no arbitrary path, model command or audio approval interface.

## Task 3: Connect manual local speech to both chats

- Write failing behavior tests for local transcript to current draft, cancellation and no cloud fallback.
- Add local/cloud/off settings and a shared dictation adapter; preserve cloud consent and manual Send. Show processing, resource and memory errors in Spanish and English.
- Cancel on account, conversation, provider, view, permission or settings changes. Preserve existing drafts and attachments.
- Expected: full Companion frontend tests and TypeScript/Vite pass.

## Task 4: Review, package and record evidence

- Run native Windows CI and full Companion regression checks; review the whole diff independently before publishing.
- Bundle only verified CPU resources and licenses; version the release, preserve preferences, publish compatible server first only if needed, then install the Companion.
- Update the seven existing status documents with observed results and pending physical acceptance. Do not claim hands-free voice or wake-word accuracy.
- Expected: release hashes and installed version match; microphone remains inactive until a user action.
