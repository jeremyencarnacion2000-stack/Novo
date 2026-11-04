use super::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::VecDeque,
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager};
use windows::{
    core::PSTR,
    Win32::{
        Foundation::{CloseHandle, HANDLE, WAIT_FAILED},
        Media::Audio::*,
        System::{
            SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX},
            Threading::{CreateEventW, WaitForSingleObject},
        },
    },
};

struct Request {
    id: String,
    cancelled: Arc<AtomicBool>,
    finish: AtomicBool,
    done: AtomicBool,
    reason: Mutex<Option<&'static str>>,
}
#[derive(Default)]
struct Registry {
    active: Option<Arc<Request>>,
    cancelled: VecDeque<String>,
}
fn registry() -> &'static Mutex<Registry> {
    static REGISTRY: OnceLock<Mutex<Registry>> = OnceLock::new();
    REGISTRY.get_or_init(|| Mutex::new(Registry::default()))
}
pub(super) fn cancel(id: Option<&str>) {
    let mut state = registry().lock().unwrap_or_else(|e| e.into_inner());
    if let Some(id) = id {
        if !state.cancelled.iter().any(|old| old == id) {
            state.cancelled.push_back(id.into());
        }
        if state.cancelled.len() > 128 {
            state.cancelled.pop_front();
        }
    }
    if let Some(active) = &state.active {
        if id.is_none() || id == Some(active.id.as_str()) {
            active.cancelled.store(true, Ordering::SeqCst);
        }
    }
}
pub(super) fn finish(id: &str) {
    if let Some(active) = &registry().lock().unwrap_or_else(|e| e.into_inner()).active {
        if active.id == id {
            active.finish.store(true, Ordering::SeqCst);
        }
    }
}
fn available_memory() -> u64 {
    let mut memory = MEMORYSTATUSEX {
        dwLength: std::mem::size_of::<MEMORYSTATUSEX>() as u32,
        ..Default::default()
    };
    if unsafe { GlobalMemoryStatusEx(&mut memory) }.is_ok() {
        memory.ullAvailPhys
    } else {
        0
    }
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Event<'a> {
    request_id: &'a str,
    state: &'a str,
    text: Option<&'a str>,
    code: Option<&'a str>,
}
fn emit(
    app: &tauri::AppHandle,
    request: &Request,
    state: &str,
    text: Option<&str>,
    code: Option<&str>,
) {
    let _ = app.emit(
        "novo-voice-input",
        Event {
            request_id: &request.id,
            state,
            text,
            code,
        },
    );
}
fn enabled(app: &tauri::AppHandle) -> bool {
    app.state::<crate::Shared>()
        .settings
        .lock()
        .map(|s| s.voice_input_mode == crate::settings::VoiceInputMode::Local)
        .unwrap_or(false)
}
pub(super) fn start(app: tauri::AppHandle, id: String) -> Result<(), String> {
    if !enabled(&app) {
        return Err("speech_disabled".into());
    }
    let request = Arc::new(Request {
        id,
        cancelled: Arc::new(AtomicBool::new(false)),
        finish: AtomicBool::new(false),
        done: AtomicBool::new(false),
        reason: Mutex::new(None),
    });
    {
        let mut state = registry().lock().unwrap_or_else(|e| e.into_inner());
        if state.active.is_some() {
            return Err("speech_busy".into());
        }
        if state.cancelled.contains(&request.id) {
            return Err("cancelled".into());
        }
        state.active = Some(request.clone());
    }
    let worker = request.clone();
    if std::thread::Builder::new()
        .name("novo-voice-input".into())
        .spawn(move || {
            let watcher = worker.clone();
            let watch_app = app.clone();
            let monitor = std::thread::Builder::new()
                .name("novo-voice-guard".into())
                .spawn(move || {
                    while !watcher.done.load(Ordering::SeqCst)
                        && !watcher.cancelled.load(Ordering::SeqCst)
                    {
                        let reason = if !enabled(&watch_app) {
                            Some("speech_disabled")
                        } else if !crate::voice::session_unlocked() {
                            Some("session_unavailable")
                        } else if available_memory() < MEMORY_FLOOR {
                            Some("speech_memory_low")
                        } else {
                            None
                        };
                        if let Some(reason) = reason {
                            *watcher.reason.lock().unwrap_or_else(|e| e.into_inner()) =
                                Some(reason);
                            watcher.cancelled.store(true, Ordering::SeqCst);
                            break;
                        }
                        std::thread::sleep(Duration::from_millis(25));
                    }
                });
            let result = if monitor.is_ok() {
                run(&app, &worker)
            } else {
                Err("speech_unavailable".into())
            };
            worker.done.store(true, Ordering::SeqCst);
            if let Ok(monitor) = monitor {
                let _ = monitor.join();
            }
            let cancelled = worker.cancelled.load(Ordering::SeqCst);
            let reason = *worker.reason.lock().unwrap_or_else(|e| e.into_inner());
            registry().lock().unwrap_or_else(|e| e.into_inner()).active = None;
            if let Some(reason) = reason {
                emit(&app, &worker, "error", None, Some(reason));
            } else if cancelled {
                emit(&app, &worker, "stopped", None, None);
            } else {
                match result {
                    Ok(text) => emit(&app, &worker, "finished", Some(&text), None),
                    Err(code) => emit(&app, &worker, "error", None, Some(&code)),
                }
            }
        })
        .is_err()
    {
        registry().lock().unwrap_or_else(|e| e.into_inner()).active = None;
        return Err("speech_unavailable".into());
    }
    Ok(())
}

#[derive(Deserialize)]
struct ResourceLock {
    files: Vec<Resource>,
}
#[derive(Deserialize)]
struct Resource {
    name: String,
    size: u64,
    sha256: String,
}
fn resources(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .resource_dir()
        .map_err(|_| "speech_resources_missing")?
        .join("voice");
    let lock: ResourceLock =
        serde_json::from_str(include_str!("../../../voice-resources.lock.json"))
            .map_err(|_| "speech_resources_invalid")?;
    if lock.files.is_empty() {
        return Err("speech_resources_invalid".into());
    }
    for entry in fs::read_dir(&root).map_err(|_| "speech_resources_missing")? {
        let entry = entry.map_err(|_| "speech_resources_invalid")?;
        if !lock
            .files
            .iter()
            .any(|p| p.name == entry.file_name().to_string_lossy())
        {
            return Err("speech_resources_invalid".into());
        }
    }
    for file in lock.files {
        let mut input =
            fs::File::open(root.join(&file.name)).map_err(|_| "speech_resources_missing")?;
        if input
            .metadata()
            .map_err(|_| "speech_resources_invalid")?
            .len()
            != file.size
        {
            return Err("speech_resources_invalid".into());
        }
        let mut hash = Sha256::new();
        let mut buffer = [0u8; 65536];
        loop {
            let length = input
                .read(&mut buffer)
                .map_err(|_| "speech_resources_invalid")?;
            if length == 0 {
                break;
            }
            hash.update(&buffer[..length]);
        }
        if format!("{:x}", hash.finalize()) != file.sha256 {
            return Err("speech_resources_invalid".into());
        }
    }
    Ok(root)
}
struct Files(PathBuf);
impl Drop for Files {
    fn drop(&mut self) {
        for name in ["recording.wav", "result.json"] {
            let _ = fs::remove_file(self.0.join(name));
        }
        let _ = fs::remove_dir(&self.0);
    }
}
pub(crate) fn cleanup() {
    let root = crate::platform::local_dir().join("voice-requests");
    let Ok(parent) = root.canonicalize() else {
        return;
    };
    let Ok(entries) = fs::read_dir(&parent) else {
        return;
    };
    for entry in entries.flatten() {
        if uuid::Uuid::parse_str(&entry.file_name().to_string_lossy()).is_err() {
            continue;
        }
        let path = entry.path();
        if path
            .canonicalize()
            .ok()
            .and_then(|p| p.parent().map(Path::to_path_buf))
            == Some(parent.clone())
        {
            drop(Files(path));
        }
    }
}
fn run(app: &tauri::AppHandle, request: &Request) -> Result<String, String> {
    if !memory_ready(available_memory()) {
        return Err("speech_memory_low".into());
    }
    let resources = resources(app)?;
    if request.cancelled.load(Ordering::SeqCst) {
        return Err("cancelled".into());
    }
    if !crate::voice::session_unlocked() {
        return Err("session_unavailable".into());
    }
    emit(app, request, "listening", None, None);
    let samples = record(request)?;
    if request.cancelled.load(Ordering::SeqCst) {
        return Err("cancelled".into());
    }
    if !memory_ready(available_memory()) {
        return Err("speech_memory_low".into());
    }
    emit(app, request, "processing", None, None);
    let root = crate::platform::local_dir().join("voice-requests");
    crate::platform::ensure_private_dir(&root).map_err(|_| "speech_unavailable")?;
    let directory = root.join(&request.id);
    fs::create_dir(&directory).map_err(|_| "speech_unavailable")?;
    let files = Files(directory);
    fs::write(files.0.join("recording.wav"), wav(&samples)?).map_err(|_| "speech_unavailable")?;
    let mut args: Vec<String> = [
        "--no-gpu",
        "--threads",
        "2",
        "--processors",
        "1",
        "--language",
        "auto",
        "--vad",
        "--no-prints",
        "--output-json-full",
        "--temperature",
        "0",
        "--temperature-inc",
        "0",
        "--logprob-thold",
        "-0.65",
        "--no-speech-thold",
        "0.6",
    ]
    .into_iter()
    .map(String::from)
    .collect();
    for (flag, path) in [
        ("--model", resources.join("ggml-tiny-q5_1.bin")),
        ("--vad-model", resources.join("ggml-silero-v6.2.0.bin")),
        ("--file", files.0.join("recording.wav")),
        ("--output-file", files.0.join("result")),
    ] {
        args.push(flag.into());
        args.push(path.to_string_lossy().into_owned());
    }
    let output = crate::project_work::process::run_guarded(
        &resources.join("whisper-cli.exe"),
        &args,
        Some(&resources),
        None,
        60,
        64 * 1024,
        request.cancelled.clone(),
    )
    .map_err(|_| "speech_unavailable")?;
    if !output.success || request.cancelled.load(Ordering::SeqCst) {
        return Err("speech_unavailable".into());
    }
    let path = files.0.join("result.json");
    if fs::metadata(&path).map_err(|_| "speech_uncertain")?.len() > 256 * 1024 {
        return Err("speech_uncertain".into());
    }
    transcript(&fs::read(path).map_err(|_| "speech_uncertain")?)
}

struct Recording {
    handle: Option<HWAVEIN>,
    event: HANDLE,
    headers: Vec<Box<WAVEHDR>>,
    buffers: Vec<Box<[i16; 1600]>>,
    prepared: usize,
}
impl Drop for Recording {
    fn drop(&mut self) {
        unsafe {
            if let Some(handle) = self.handle {
                let _ = waveInReset(handle);
                for header in self.headers.iter_mut().take(self.prepared) {
                    let _ = waveInUnprepareHeader(
                        handle,
                        &mut **header,
                        std::mem::size_of::<WAVEHDR>() as u32,
                    );
                }
                let _ = waveInClose(handle);
            }
            let _ = CloseHandle(self.event);
        }
    }
}
fn record(request: &Request) -> Result<Vec<i16>, String> {
    unsafe {
        let event = CreateEventW(None, false, false, None).map_err(|_| "microphone_unavailable")?;
        let mut recording = Recording {
            handle: None,
            event,
            headers: Vec::new(),
            buffers: Vec::new(),
            prepared: 0,
        };
        let format = WAVEFORMATEX {
            wFormatTag: 1,
            nChannels: 1,
            nSamplesPerSec: 16000,
            nAvgBytesPerSec: 32000,
            nBlockAlign: 2,
            wBitsPerSample: 16,
            cbSize: 0,
        };
        let mut handle = HWAVEIN::default();
        if waveInOpen(
            Some(&mut handle),
            WAVE_MAPPER,
            &format,
            Some(event.0 as usize),
            None,
            CALLBACK_EVENT,
        ) != 0
        {
            return Err("microphone_unavailable".into());
        }
        recording.handle = Some(handle);
        for _ in 0..3 {
            let mut buffer = Box::new([0i16; 1600]);
            let mut header = Box::new(WAVEHDR {
                lpData: PSTR(buffer.as_mut_ptr().cast()),
                dwBufferLength: 3200,
                ..Default::default()
            });
            let ptr = &mut *header as *mut WAVEHDR;
            recording.buffers.push(buffer);
            recording.headers.push(header);
            if waveInPrepareHeader(handle, ptr, std::mem::size_of::<WAVEHDR>() as u32) != 0 {
                return Err("microphone_unavailable".into());
            }
            recording.prepared += 1;
            if waveInAddBuffer(handle, ptr, std::mem::size_of::<WAVEHDR>() as u32) != 0 {
                return Err("microphone_unavailable".into());
            }
        }
        if request.cancelled.load(Ordering::SeqCst) {
            return Err("cancelled".into());
        }
        if waveInStart(handle) != 0 {
            return Err("microphone_unavailable".into());
        }
        let started = Instant::now();
        let mut samples = Vec::with_capacity(MAX_SAMPLES);
        let mut gate = SignalGate::default();
        'capture: while started.elapsed() < Duration::from_secs(20) && samples.len() < MAX_SAMPLES {
            if request.cancelled.load(Ordering::SeqCst) {
                return Err("cancelled".into());
            }
            if request.finish.load(Ordering::SeqCst) {
                break;
            }
            if WaitForSingleObject(event, 25) == WAIT_FAILED {
                return Err("microphone_unavailable".into());
            }
            for i in 0..recording.headers.len() {
                let ptr = &mut *recording.headers[i] as *mut WAVEHDR;
                if std::ptr::read_volatile(std::ptr::addr_of!((*ptr).dwFlags)) & WHDR_DONE == 0 {
                    continue;
                }
                let count = (std::ptr::read_volatile(std::ptr::addr_of!((*ptr).dwBytesRecorded))
                    as usize
                    / 2)
                .min(1600)
                .min(MAX_SAMPLES - samples.len());
                let chunk = &recording.buffers[i][..count];
                samples.extend_from_slice(chunk);
                if gate.push(chunk) {
                    break 'capture;
                }
                (*ptr).dwBytesRecorded = 0;
                if waveInAddBuffer(handle, ptr, std::mem::size_of::<WAVEHDR>() as u32) != 0 {
                    return Err("microphone_unavailable".into());
                }
            }
            if !gate.has_speech() && started.elapsed() > Duration::from_secs(8) {
                break;
            }
        }
        if !gate.has_speech() {
            return Err("no_speech".into());
        }
        Ok(samples)
    }
}
