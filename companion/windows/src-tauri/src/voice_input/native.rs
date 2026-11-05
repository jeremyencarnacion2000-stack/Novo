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
    emitted_at_ms: u64,
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
            emitted_at_ms: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|v| v.as_millis() as u64)
                .unwrap_or(0),
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
            let started = Instant::now();
            let mut timings = crate::voice_metrics::PipelineTimings::default();
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
                run(&app, &worker, &mut timings)
            } else {
                Err("speech_unavailable".into())
            };
            worker.done.store(true, Ordering::SeqCst);
            if let Ok(monitor) = monitor {
                let _ = monitor.join();
            }
            let cancelled = worker.cancelled.load(Ordering::SeqCst);
            let reason = *worker.reason.lock().unwrap_or_else(|e| e.into_inner());
            timings.native_total_ms = started.elapsed().as_millis() as u64;
            crate::log::line(format!("voice-input {}", serde_json::json!({
                "requestId":&worker.id,
                "outcome":if cancelled {"cancelled"} else if result.is_ok() && reason.is_none() {"accepted"} else {"rejected"},
                "timings":timings,
            })));
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
fn run(
    app: &tauri::AppHandle,
    request: &Request,
    timings: &mut crate::voice_metrics::PipelineTimings,
) -> Result<String, String> {
    if !memory_ready(available_memory()) {
        return Err("speech_memory_low".into());
    }
    let started = Instant::now();
    let resources = resources(app);
    timings.resource_validation_ms = Some(started.elapsed().as_millis() as u64);
    let resources = resources?;
    if request.cancelled.load(Ordering::SeqCst) {
        return Err("cancelled".into());
    }
    if !crate::voice::session_unlocked() {
        return Err("session_unavailable".into());
    }
    let language = app
        .state::<crate::Shared>()
        .settings
        .lock()
        .map_err(|_| "speech_unavailable")?
        .voice_input_language
        .code();
    let started = Instant::now();
    let captured = record(
        request,
        || emit(app, request, "listening", None, None),
        timings,
    );
    if let (Some(prepare), Some(capture)) = (timings.microphone_prepare_ms, timings.capture_wall_ms)
    {
        timings.capture_cleanup_ms =
            Some((started.elapsed().as_millis() as u64).saturating_sub(prepare + capture));
    }
    let samples = captured?;
    timings.audio_ms = Some(samples.len() as u64 * 1000 / 16000);
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
        language,
        "--vad",
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
    let started = Instant::now();
    let output = crate::project_work::process::run_guarded_diagnostics(
        &resources.join("whisper-cli.exe"),
        &args,
        Some(&resources),
        60,
        64 * 1024,
        request.cancelled.clone(),
    );
    timings.process_ms = Some(started.elapsed().as_millis() as u64);
    let (output, diagnostic) = output.map_err(|_| "speech_unavailable")?;
    timings.engine = crate::voice_metrics::engine_timings(&diagnostic);
    if !output.success || request.cancelled.load(Ordering::SeqCst) {
        return Err("speech_unavailable".into());
    }
    let path = files.0.join("result.json");
    if fs::metadata(&path).map_err(|_| "speech_uncertain")?.len() > 256 * 1024 {
        return Err("speech_uncertain".into());
    }
    let started = Instant::now();
    let result = transcript(&fs::read(path).map_err(|_| "speech_uncertain")?);
    timings.transcript_validation_ms = Some(started.elapsed().as_millis() as u64);
    result
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
        #[cfg(test)]
        let started = Instant::now();
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
        #[cfg(test)]
        eprintln!("MIC CLEANUP {} ms", started.elapsed().as_millis());
    }
}
fn record(
    request: &Request,
    ready: impl FnOnce(),
    timings: &mut crate::voice_metrics::PipelineTimings,
) -> Result<Vec<i16>, String> {
    unsafe {
        let started = Instant::now();
        let event = CreateEventW(None, false, false, None).map_err(|_| "microphone_unavailable")?;
        #[cfg(test)]
        eprintln!("MIC EVENT {} ms", started.elapsed().as_millis());
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
        #[cfg(test)]
        eprintln!("MIC OPEN {} ms", started.elapsed().as_millis());
        recording.handle = Some(handle);
        for _ in 0..CAPTURE_BUFFERS {
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
        #[cfg(test)]
        eprintln!("MIC PREPARED {} ms", started.elapsed().as_millis());
        if request.cancelled.load(Ordering::SeqCst) {
            return Err("cancelled".into());
        }
        if waveInStart(handle) != 0 {
            return Err("microphone_unavailable".into());
        }
        timings.microphone_prepare_ms = Some(started.elapsed().as_millis() as u64);
        ready();
        #[cfg(test)]
        eprintln!("MIC STARTED {} ms", started.elapsed().as_millis());
        let started = Instant::now();
        let mut samples = Vec::with_capacity(MAX_SAMPLES);
        let mut gate = SignalGate::default();
        let mut order = CaptureOrder::default();
        let mut endpoint = "duration_limit";
        'capture: while started.elapsed() < Duration::from_secs(20) && samples.len() < MAX_SAMPLES {
            if request.cancelled.load(Ordering::SeqCst) {
                #[cfg(test)]
                eprintln!("MIC SAW CANCEL {} ms", started.elapsed().as_millis());
                return Err("cancelled".into());
            }
            if request.finish.load(Ordering::SeqCst) {
                endpoint = "manual";
                break;
            }
            if WaitForSingleObject(event, 25) == WAIT_FAILED {
                return Err("microphone_unavailable".into());
            }
            while let Some(i) = order.take(|i| {
                std::ptr::read_volatile(std::ptr::addr_of!(recording.headers[i].dwFlags))
                    & WHDR_DONE
                    != 0
            }) {
                let ptr = &mut *recording.headers[i] as *mut WAVEHDR;
                let count = (std::ptr::read_volatile(std::ptr::addr_of!((*ptr).dwBytesRecorded))
                    as usize
                    / 2)
                .min(1600)
                .min(MAX_SAMPLES - samples.len());
                let chunk = &recording.buffers[i][..count];
                samples.extend_from_slice(chunk);
                if gate.push(chunk) {
                    endpoint = "energy_silence";
                    break 'capture;
                }
                (*ptr).dwBytesRecorded = 0;
                if waveInAddBuffer(handle, ptr, std::mem::size_of::<WAVEHDR>() as u32) != 0 {
                    return Err("microphone_unavailable".into());
                }
            }
            if !gate.has_speech() && started.elapsed() > Duration::from_secs(8) {
                endpoint = "no_speech";
                break;
            }
        }
        timings.capture_wall_ms = Some(started.elapsed().as_millis() as u64);
        timings.endpoint_reason = Some(endpoint);
        timings.endpoint_quiet_ms = Some(gate.quiet as u64 * 1000 / 16000);
        if !gate.has_speech() {
            return Err("no_speech".into());
        }
        Ok(samples)
    }
}

#[cfg(test)]
mod physical_acceptance {
    use super::*;
    use std::io::Write;

    fn normalized(value: &str) -> String {
        value
            .chars()
            .filter(|c| c.is_alphanumeric())
            .flat_map(char::to_lowercase)
            .collect()
    }

    fn recognize_phrase(resources: &Path, phrase: &str, language: &str) -> bool {
        let request = Request {
            id: uuid::Uuid::new_v4().to_string(),
            cancelled: Arc::new(AtomicBool::new(false)),
            finish: AtomicBool::new(false),
            done: AtomicBool::new(false),
            reason: Mutex::new(None),
        };
        print!("MIC CAPTURE ({language}) starts in 4 seconds: say ‘{phrase}’; silence stops capture.\n");
        let _ = std::io::stdout().flush();
        std::thread::sleep(Duration::from_secs(4));
        let started = Instant::now();
        let samples = record(
            &request,
            || {},
            &mut crate::voice_metrics::PipelineTimings::default(),
        )
        .expect("physical microphone capture failed");
        let capture_ms = started.elapsed().as_millis();
        let audio_ms = samples.len() as u128 * 1000 / 16_000;
        assert!(
            memory_ready(available_memory()),
            "insufficient available memory for local speech"
        );

        let root = crate::platform::local_dir().join("voice-requests");
        crate::platform::ensure_private_dir(&root)
            .expect("could not prepare private speech temp directory");
        let directory = root.join(&request.id);
        fs::create_dir(&directory).expect("could not create private speech request directory");
        let files = Files(directory);
        fs::write(files.0.join("recording.wav"), wav(&samples).unwrap()).unwrap();
        let mut fast_accepted = false;
        for (variant, model_language, threads, beam) in [
            ("current", "auto", "2", "5"),
            ("fixed-fast", language, "4", "1"),
        ] {
            let mut args: Vec<String> = [
                "--no-gpu",
                "--threads",
                threads,
                "--processors",
                "1",
                "--beam-size",
                beam,
                "--language",
                model_language,
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
            let started = Instant::now();
            let output = crate::project_work::process::run_guarded(
                &resources.join("whisper-cli.exe"),
                &args,
                Some(resources),
                None,
                60,
                64 * 1024,
                request.cancelled.clone(),
            )
            .expect("local Whisper/Silero process failed");
            let inference_ms = started.elapsed().as_millis();
            assert!(
                output.success,
                "local Whisper/Silero process returned an error"
            );
            let result = fs::read(files.0.join("result.json")).unwrap();
            let value: Value = serde_json::from_slice(&result).unwrap();
            let detected_language = value["result"]["language"].as_str().unwrap_or("missing");
            let segments = value["transcription"].as_array();
            let raw_text = segments
                .into_iter()
                .flatten()
                .filter_map(|segment| segment["text"].as_str())
                .collect::<String>();
            let phrase_match = normalized(&raw_text).contains(&normalized(phrase));
            let probabilities: Vec<f64> = segments
                .into_iter()
                .flatten()
                .flat_map(|segment| segment["tokens"].as_array().into_iter().flatten())
                .filter(|token| token["id"].as_u64().is_some_and(|id| id < 50257))
                .filter_map(|token| token["p"].as_f64().filter(|p| *p > 0.0 && *p <= 1.0))
                .collect();
            let confidence = (!probabilities.is_empty()).then(|| {
                (probabilities.iter().map(|p| p.ln()).sum::<f64>() / probabilities.len() as f64)
                    .exp()
            });
            let status = match transcript(&result) {
                Ok(text) if phrase_match && normalized(&text).contains(&normalized(phrase)) => {
                    "accepted".to_string()
                }
                Ok(_) => "mismatch".to_string(),
                Err(code) if phrase_match => format!("{code}_phrase_match"),
                Err(code) => code,
            };
            println!("VOICE MODEL: variant={variant}, expected={language}, detected={detected_language}, lexical_tokens={}, phrase_match={phrase_match}, confidence={confidence:?}, audio_ms={audio_ms}, capture_ms={capture_ms}, inference_ms={inference_ms}, status={status}; transcript withheld", probabilities.len());
            fast_accepted |= variant == "fixed-fast" && status == "accepted";
        }
        fast_accepted
    }

    #[test]
    #[ignore = "Manual physical microphone acceptance; requires the user to speak two phrases"]
    fn physical_microphone_whisper_silero_es_en() {
        let resources = crate::platform::local_dir().join("voice");
        assert!(
            resources.join("whisper-cli.exe").is_file(),
            "installed Whisper resources missing"
        );
        let es = recognize_phrase(
            &resources,
            "Novo, abre Codex y continuemos con ClickHome",
            "es",
        );
        let en = recognize_phrase(
            &resources,
            "Novo, open Codex and continue with ClickHome",
            "en",
        );
        assert!(es, "Spanish physical recognition did not pass");
        assert!(en, "English physical recognition did not pass");
    }

    #[test]
    #[ignore = "Manual physical microphone cancellation check"]
    fn physical_microphone_cancel_stops_capture() {
        let request = Arc::new(Request {
            id: uuid::Uuid::new_v4().to_string(),
            cancelled: Arc::new(AtomicBool::new(false)),
            finish: AtomicBool::new(false),
            done: AtomicBool::new(false),
            reason: Mutex::new(None),
        });
        let capture = request.clone();
        let worker = std::thread::spawn(move || {
            record(
                &capture,
                || {},
                &mut crate::voice_metrics::PipelineTimings::default(),
            )
        });
        std::thread::sleep(Duration::from_millis(500));
        let started = Instant::now();
        request.cancelled.store(true, Ordering::SeqCst);
        assert!(matches!(worker.join().unwrap(), Err(ref code) if code == "cancelled"));
        let elapsed_ms = started.elapsed().as_millis();
        println!("VOICE CANCEL RESULT: cancellation completed in {elapsed_ms} ms");
        assert!(elapsed_ms <= 250, "microphone cancellation exceeded 250 ms");
    }
}
