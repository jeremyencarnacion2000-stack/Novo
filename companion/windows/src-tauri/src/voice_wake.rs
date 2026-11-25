#[cfg(windows)]
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};

#[cfg(windows)]
static ACTIVE: Mutex<Option<(String, Arc<AtomicBool>)>> = Mutex::new(None);

#[cfg(windows)]
pub async fn release_microphone() -> Result<(), String> {
    for _ in 0..30 {
        {
            let active = ACTIVE.lock().unwrap_or_else(|e| e.into_inner());
            let Some((_, cancel)) = active.as_ref() else {
                return Ok(());
            };
            cancel.store(true, Ordering::SeqCst);
        }
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }
    Err("microphone_unavailable".into())
}

#[tauri::command]
pub async fn voice_wake_wait(
    app: tauri::AppHandle,
    shared: tauri::State<'_, crate::Shared>,
    request_id: String,
) -> Result<bool, String> {
    #[cfg(not(windows))]
    {
        let _ = (app, shared, request_id);
        Err("wake_unavailable".into())
    }
    #[cfg(windows)]
    {
        use tauri::{path::BaseDirectory, Manager};
        let allowed = || {
            let settings = shared.settings.lock().unwrap_or_else(|e| e.into_inner());
            settings.voice_wake_enabled
                && settings.voice_input_mode == crate::settings::VoiceInputMode::Local
        };
        if uuid::Uuid::parse_str(&request_id).is_err()
            || !allowed()
            || !crate::voice::session_unlocked()
        {
            return Err("wake_unavailable".into());
        }
        let script = app
            .path()
            .resolve("voice-tools/wake.ps1", BaseDirectory::Resource)
            .map_err(|_| "wake_unavailable")?;
        let exe = std::path::PathBuf::from(std::env::var_os("WINDIR").ok_or("wake_unavailable")?)
            .join("System32/WindowsPowerShell/v1.0/powershell.exe");
        let cancel = Arc::new(AtomicBool::new(false));
        {
            let mut active = ACTIVE.lock().unwrap_or_else(|e| e.into_inner());
            if active.is_some() {
                return Err("wake_busy".into());
            }
            *active = Some((request_id, cancel.clone()));
        }
        let child_cancel = cancel.clone();
        let mut run = tauri::async_runtime::spawn_blocking(move || {
            let args = [
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
            ]
            .into_iter()
            .map(String::from)
            .chain([script.to_string_lossy().into_owned()])
            .collect::<Vec<_>>();
            crate::project_work::process::run_guarded(&exe, &args, None, None, 27, 32, child_cancel)
        });
        let mut tick = tokio::time::interval(std::time::Duration::from_millis(250));
        let result = loop {
            tokio::select! {
                result = &mut run => break result,
                _ = tick.tick() => {
                    if !allowed() || !crate::voice::session_unlocked() {
                        cancel.store(true, Ordering::SeqCst);
                    }
                }
            }
        };
        *ACTIVE.lock().unwrap_or_else(|e| e.into_inner()) = None;
        if cancel.load(Ordering::SeqCst) {
            return Ok(false);
        }
        let result = result
            .map_err(|_| "wake_unavailable")?
            .map_err(|_| "wake_unavailable")?;
        if !result.success {
            return Err("wake_unavailable".into());
        }
        Ok(allowed() && crate::voice::session_unlocked() && result.bytes == b"novo")
    }
}

#[tauri::command]
pub fn voice_wake_cancel(request_id: String) {
    #[cfg(windows)]
    if let Some((_, cancel)) = ACTIVE
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .as_ref()
        .filter(|(id, _)| id == &request_id)
    {
        cancel.store(true, Ordering::SeqCst);
    }
    #[cfg(not(windows))]
    let _ = request_id;
}
