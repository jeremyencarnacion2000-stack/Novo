// Local Windows SAPI only. Text never reaches a model or network service.
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::Mutex;

#[cfg(windows)]
pub(crate) fn session_unlocked() -> bool {
    native::unlocked()
}

#[derive(Default)]
struct Cancellations {
    ids: VecDeque<String>,
}
impl Cancellations {
    fn cancel(&mut self, id: String) {
        if !self.ids.contains(&id) {
            self.ids.push_back(id);
            if self.ids.len() > 128 {
                self.ids.pop_front();
            }
        }
    }
    fn contains(&self, id: &str) -> bool {
        self.ids.iter().any(|value| value == id)
    }
}
fn prepare_and_speak<T>(
    state: &Mutex<Cancellations>,
    id: &str,
    prepare: impl FnOnce() -> Result<T, String>,
    unlocked: impl Fn() -> bool,
    speak: impl FnOnce(T) -> Result<(), String>,
) -> Result<(), String> {
    if state.lock().unwrap_or_else(|e| e.into_inner()).contains(id) {
        return Err("cancelled".into());
    }
    if !unlocked() {
        return Err("session_unavailable".into());
    }
    let ready = prepare()?;
    // Cancellation and audio startup share this lock; preparation may load a voice.
    let current = state.lock().unwrap_or_else(|e| e.into_inner());
    if current.contains(id) {
        return Err("cancelled".into());
    }
    if !unlocked() {
        return Err("session_unavailable".into());
    }
    let result = speak(ready);
    drop(current);
    result
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceChoice {
    id: String,
    name: String,
    spanish: bool,
}

fn validate_request(id: &str, text: &str) -> Result<(), String> {
    if uuid::Uuid::parse_str(id).is_err()
        || text.trim().is_empty()
        || text.chars().count() > 6000
        || text.contains('\0')
    {
        return Err("invalid_speech_request".into());
    }
    Ok(())
}
fn spanish_languages(value: &str) -> bool {
    value.split(';').any(|id| {
        u16::from_str_radix(id.trim(), 16)
            .map(|id| id & 0x03ff == 0x000a)
            .unwrap_or(false)
    })
}

#[tauri::command]
pub async fn voice_choices() -> Result<Vec<VoiceChoice>, String> {
    #[cfg(windows)]
    {
        native::choices().await
    }
    #[cfg(not(windows))]
    {
        Err("speech_unavailable".into())
    }
}

#[tauri::command]
pub async fn voice_speak(
    app: tauri::AppHandle,
    shared: tauri::State<'_, crate::Shared>,
    request_id: String,
    text: String,
) -> Result<(), String> {
    validate_request(&request_id, &text)?;
    #[cfg(windows)]
    {
        let voice_id = shared
            .settings
            .lock()
            .map_err(|_| "speech_unavailable")?
            .voice_local_voice_id
            .clone();
        native::speak(app, request_id, text, voice_id).await
    }
    #[cfg(not(windows))]
    {
        let _ = (app, shared);
        Err("speech_unavailable".into())
    }
}

#[tauri::command]
pub async fn voice_stop(request_id: String) -> Result<(), String> {
    if uuid::Uuid::parse_str(&request_id).is_err() {
        return Err("invalid_speech_request".into());
    }
    #[cfg(windows)]
    {
        native::stop(request_id).await
    }
    #[cfg(not(windows))]
    {
        Ok(())
    }
}

#[cfg(windows)]
mod native {
    use super::*;
    use sha2::{Digest, Sha256};
    use std::{
        sync::{mpsc, Mutex, OnceLock},
        time::Duration,
    };
    use tauri::Emitter;
    use tokio::sync::oneshot;
    use windows::{
        core::{w, PCWSTR, PWSTR},
        Win32::{
            Foundation::{WAIT_FAILED, WAIT_OBJECT_0},
            Media::Speech::*,
            System::{Com::*, RemoteDesktop::*, Threading::WaitForSingleObject},
        },
    };

    enum Command {
        Choices(oneshot::Sender<Result<Vec<VoiceChoice>, String>>),
        Speak {
            app: tauri::AppHandle,
            id: String,
            text: String,
            voice_id: String,
            reply: oneshot::Sender<Result<(), String>>,
        },
        Stop(String, oneshot::Sender<()>),
    }
    static WORKER: OnceLock<Result<mpsc::SyncSender<Command>, String>> = OnceLock::new();
    static CANCELLED: OnceLock<Mutex<Cancellations>> = OnceLock::new();
    fn cancellation_state() -> &'static Mutex<Cancellations> {
        CANCELLED.get_or_init(|| Mutex::new(Cancellations::default()))
    }
    fn cancellations() -> std::sync::MutexGuard<'static, Cancellations> {
        cancellation_state()
            .lock()
            .unwrap_or_else(|e| e.into_inner())
    }
    fn dispatch(command: Command) -> Result<(), String> {
        WORKER
            .get_or_init(|| {
                let (tx, rx) = mpsc::sync_channel(8);
                std::thread::Builder::new()
                    .name("novo-local-speech".into())
                    .spawn(move || run(rx))
                    .map_err(|_| "speech_unavailable".to_string())?;
                Ok(tx)
            })
            .as_ref()
            .map_err(Clone::clone)?
            .try_send(command)
            .map_err(|_| "speech_unavailable".into())
    }
    pub async fn choices() -> Result<Vec<VoiceChoice>, String> {
        let (tx, rx) = oneshot::channel();
        dispatch(Command::Choices(tx))?;
        rx.await.map_err(|_| "speech_unavailable".to_string())?
    }
    pub async fn speak(
        app: tauri::AppHandle,
        id: String,
        text: String,
        voice_id: String,
    ) -> Result<(), String> {
        let (tx, rx) = oneshot::channel();
        dispatch(Command::Speak {
            app,
            id,
            text,
            voice_id,
            reply: tx,
        })?;
        rx.await.map_err(|_| "speech_unavailable".to_string())?
    }
    pub async fn stop(id: String) -> Result<(), String> {
        // Mark before enqueueing: cancellation wins even when a start arrives late.
        cancellations().cancel(id.clone());
        if WORKER.get().is_none() {
            return Ok(());
        }
        let (tx, rx) = oneshot::channel();
        dispatch(Command::Stop(id, tx))?;
        rx.await.map_err(|_| "speech_unavailable".into())
    }
    #[derive(Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct Event<'a> {
        request_id: &'a str,
        state: &'a str,
        code: Option<&'a str>,
    }
    fn emit(app: &tauri::AppHandle, id: &str, state: &str, code: Option<&str>) {
        let _ = app.emit(
            "novo-speech-state",
            Event {
                request_id: id,
                state,
                code,
            },
        );
    }
    struct Com;
    impl Drop for Com {
        fn drop(&mut self) {
            unsafe {
                CoUninitialize();
            }
        }
    }
    unsafe fn owned_string(ptr: PWSTR) -> String {
        let value = unsafe { ptr.to_string() }.unwrap_or_default();
        unsafe {
            CoTaskMemFree(Some(ptr.0.cast()));
        }
        value
    }
    unsafe fn voices() -> windows::core::Result<Vec<(VoiceChoice, ISpObjectToken)>> {
        let category: ISpObjectTokenCategory =
            unsafe { CoCreateInstance(&SpObjectTokenCategory, None, CLSCTX_INPROC_SERVER) }?;
        unsafe { category.SetId(SPCAT_VOICES, false) }?;
        let tokens = unsafe { category.EnumTokens(PCWSTR::null(), PCWSTR::null()) }?;
        let mut count = 0;
        unsafe { tokens.GetCount(&mut count) }?;
        let mut found = Vec::new();
        for i in 0..count.min(128) {
            let token = unsafe { tokens.Item(i) }?;
            let id = unsafe { owned_string(token.GetId()?) };
            let name = unsafe { owned_string(token.GetStringValue(PCWSTR::null())?) };
            let attrs = unsafe { token.OpenKey(w!("Attributes")) }?;
            let vendor = unsafe { owned_string(attrs.GetStringValue(w!("Vendor"))?) };
            if !vendor.eq_ignore_ascii_case("Microsoft") {
                continue;
            }
            let language = unsafe { owned_string(attrs.GetStringValue(w!("Language"))?) };
            found.push((
                VoiceChoice {
                    id: format!("{:x}", Sha256::digest(id.as_bytes())),
                    name,
                    spanish: spanish_languages(&language),
                },
                token,
            ));
        }
        Ok(found)
    }
    // Fail closed on locked, disconnected or unqueryable Windows sessions.
    pub(super) fn unlocked() -> bool {
        unsafe {
            let mut ptr = PWSTR::null();
            let mut len = 0;
            if WTSQuerySessionInformationW(
                None,
                WTS_CURRENT_SESSION,
                WTSSessionInfoEx,
                &mut ptr,
                &mut len,
            )
            .is_err()
            {
                return false;
            }
            let ok = if !ptr.is_null() && len as usize >= std::mem::size_of::<WTSINFOEXW>() {
                let info = &*ptr.0.cast::<WTSINFOEXW>();
                let data = info.Data.WTSInfoExLevel1;
                info.Level == 1
                    && data.SessionState == WTSActive
                    && data.SessionFlags == WTS_SESSIONSTATE_UNLOCK as i32
            } else {
                false
            };
            WTSFreeMemory(ptr.0.cast());
            ok
        }
    }
    fn purge(voice: &ISpVoice) {
        unsafe {
            let _ = voice.Speak(
                PCWSTR::null(),
                (SPF_ASYNC.0 | SPF_PURGEBEFORESPEAK.0 | SPF_IS_NOT_XML.0) as u32,
                None,
            );
        }
    }
    #[cfg(test)]
    mod tests {
        #[test]
        #[ignore = "Manual Windows capability probe; no microphone or audio playback"]
        fn probe_local_voice_capabilities() {
            unsafe { super::CoInitializeEx(None, super::COINIT_MULTITHREADED) }
                .ok()
                .unwrap();
            let _com = super::Com;
            let choices = unsafe { super::voices() }.unwrap();
            println!(
                "Microsoft voices: {}; Spanish available: {}; Windows unlocked: {}",
                choices.len(),
                choices.iter().any(|(voice, _)| voice.spanish),
                super::unlocked()
            );
            assert!(choices.iter().all(|(voice, _)| voice.id.len() == 64));
        }
    }
    fn run(rx: mpsc::Receiver<Command>) {
        let initialized = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }.is_ok();
        let _com = initialized.then_some(Com);
        let voice: Option<ISpVoice> = if initialized {
            unsafe { CoCreateInstance(&SpVoice, None, CLSCTX_INPROC_SERVER) }.ok()
        } else {
            None
        };
        let mut active: Option<(tauri::AppHandle, String)> = None;
        loop {
            let command = if active.is_some() {
                match rx.recv_timeout(Duration::from_millis(40)) {
                    Ok(cmd) => Some(cmd),
                    Err(mpsc::RecvTimeoutError::Timeout) => None,
                    Err(_) => break,
                }
            } else {
                match rx.recv() {
                    Ok(cmd) => Some(cmd),
                    Err(_) => break,
                }
            };
            if let Some(command) = command {
                match command {
                    Command::Choices(reply) => {
                        let result = if initialized {
                            unsafe { voices() }
                                .map(|v| v.into_iter().map(|(choice, _)| choice).collect())
                                .map_err(|_| "speech_unavailable".into())
                        } else {
                            Err("speech_unavailable".into())
                        };
                        let _ = reply.send(result);
                    }
                    Command::Stop(id, reply) => {
                        if active.as_ref().is_some_and(|(_, current)| current == &id) {
                            if let Some(voice) = &voice {
                                purge(voice);
                            }
                            if let Some((app, id)) = active.take() {
                                emit(&app, &id, "stopped", None);
                            }
                        }
                        let _ = reply.send(());
                    }
                    Command::Speak {
                        app,
                        id,
                        text,
                        voice_id,
                        reply,
                    } => {
                        if cancellations().contains(&id) {
                            let _ = reply.send(Err("cancelled".into()));
                            continue;
                        }
                        if let Some(voice) = &voice {
                            purge(voice);
                        }
                        if let Some((old_app, old_id)) = active.take() {
                            emit(&old_app, &old_id, "stopped", None);
                        }
                        let result = prepare_and_speak(
                            cancellation_state(),
                            &id,
                            || {
                                let voice = voice.as_ref().ok_or("speech_unavailable")?;
                                let choices =
                                    unsafe { voices() }.map_err(|_| "speech_unavailable")?;
                                let chosen = choices
                                    .iter()
                                    .find(|(v, _)| {
                                        if voice_id.is_empty() {
                                            v.spanish
                                        } else {
                                            v.id == voice_id
                                        }
                                    })
                                    .ok_or(if voice_id.is_empty() {
                                        "spanish_voice_missing"
                                    } else {
                                        "voice_not_found"
                                    })?;
                                let wide: Vec<u16> = text.encode_utf16().chain(Some(0)).collect();
                                unsafe { voice.SetVoice(&chosen.1) }
                                    .map_err(|_| "speech_unavailable".to_string())?;
                                Ok(wide)
                            },
                            unlocked,
                            |wide| {
                                unsafe {
                                    voice.as_ref().ok_or("speech_unavailable")?.Speak(
                                        PCWSTR(wide.as_ptr()),
                                        (SPF_ASYNC.0 | SPF_PURGEBEFORESPEAK.0 | SPF_IS_NOT_XML.0)
                                            as u32,
                                        None,
                                    )
                                }
                                .map_err(|_| "speech_unavailable".to_string())
                            },
                        );
                        if result.is_ok() {
                            emit(&app, &id, "speaking", None);
                            active = Some((app, id));
                        }
                        let _ = reply.send(result);
                    }
                }
            }
            if let (Some(voice), Some((app, id))) = (&voice, &active) {
                let event = unsafe { voice.SpeakCompleteEvent() };
                let result = if event.is_invalid() {
                    WAIT_FAILED
                } else {
                    unsafe { WaitForSingleObject(event, 0) }
                };
                let state = if cancellations().contains(id) || !unlocked() {
                    purge(voice);
                    Some(("stopped", None))
                } else if result == WAIT_FAILED {
                    purge(voice);
                    Some(("error", Some("speech_unavailable")))
                } else if result == WAIT_OBJECT_0 {
                    Some(("finished", None))
                } else {
                    None
                };
                if let Some((state, code)) = state {
                    emit(app, id, state, code);
                    active = None;
                }
            }
        }
        if let Some(voice) = &voice {
            purge(voice);
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_text_and_request_identity() {
        let id = "c8edb8e3-96ec-43df-8ae6-ec2993edc3f8";
        assert!(validate_request(id, "Hola").is_ok());
        for text in ["".to_string(), "hola\0archivo".into(), "a".repeat(6001)] {
            assert!(validate_request(id, &text).is_err());
        }
        assert!(validate_request("not-an-id", "Hola").is_err());
    }
    #[test]
    fn matches_all_spanish_windows_language_variants() {
        assert!(spanish_languages("40a"));
        assert!(spanish_languages("409;80a"));
        assert!(!spanish_languages("409"));
        assert!(!spanish_languages("invalid"));
    }
    #[test]
    fn cancelled_requests_never_restart_and_do_not_cancel_replacements() {
        let mut cancelled = Cancellations::default();
        cancelled.cancel("old".into());
        cancelled.cancel("old".into());
        assert!(cancelled.contains("old"));
        assert!(!cancelled.contains("replacement"));
        assert_eq!(cancelled.ids.len(), 1);
        for i in 0..200 {
            cancelled.cancel(format!("id-{i}"));
        }
        assert_eq!(cancelled.ids.len(), 128);
    }
    #[test]
    fn stop_during_voice_preparation_prevents_any_audio() {
        let state = Mutex::new(Cancellations::default());
        let spoke = std::cell::Cell::new(false);
        let result = prepare_and_speak(
            &state,
            "request",
            || {
                state.lock().unwrap().cancel("request".into());
                Ok(())
            },
            || true,
            |()| {
                spoke.set(true);
                Ok(())
            },
        );
        assert_eq!(result, Err("cancelled".into()));
        assert!(!spoke.get());
    }
    #[test]
    fn lock_during_voice_preparation_prevents_any_audio() {
        let state = Mutex::new(Cancellations::default());
        let unlocked = std::cell::Cell::new(true);
        let spoke = std::cell::Cell::new(false);
        let result = prepare_and_speak(
            &state,
            "request",
            || {
                unlocked.set(false);
                Ok(())
            },
            || unlocked.get(),
            |()| {
                spoke.set(true);
                Ok(())
            },
        );
        assert_eq!(result, Err("session_unavailable".into()));
        assert!(!spoke.get());
    }
}
