use serde_json::Value;

const MAX_SAMPLES: usize = 16_000 * 20;
const MEMORY_FLOOR: u64 = 512 * 1024 * 1024;
const MODEL_BUDGET: u64 = 400 * 1024 * 1024;
const CAPTURE_BUFFERS: usize = 3;

#[derive(Default)]
struct CaptureOrder {
    next: usize,
}
impl CaptureOrder {
    fn take(&mut self, ready: impl Fn(usize) -> bool) -> Option<usize> {
        if !ready(self.next) {
            return None;
        }
        let index = self.next;
        self.next = (self.next + 1) % CAPTURE_BUFFERS;
        Some(index)
    }
}

fn wav(samples: &[i16]) -> Result<Vec<u8>, String> {
    if samples.is_empty() || samples.len() > MAX_SAMPLES {
        return Err("no_speech".into());
    }
    let length = (samples.len() * 2) as u32;
    let mut bytes = Vec::with_capacity(length as usize + 44);
    bytes.extend(b"RIFF");
    bytes.extend((length + 36).to_le_bytes());
    bytes.extend(b"WAVEfmt ");
    bytes.extend(16u32.to_le_bytes());
    bytes.extend(1u16.to_le_bytes());
    bytes.extend(1u16.to_le_bytes());
    bytes.extend(16000u32.to_le_bytes());
    bytes.extend(32000u32.to_le_bytes());
    bytes.extend(2u16.to_le_bytes());
    bytes.extend(16u16.to_le_bytes());
    bytes.extend(b"data");
    bytes.extend(length.to_le_bytes());
    for sample in samples {
        bytes.extend(sample.to_le_bytes());
    }
    Ok(bytes)
}
fn transcript(bytes: &[u8]) -> Result<String, String> {
    if bytes.len() > 256 * 1024 {
        return Err("speech_uncertain".into());
    }
    let value: Value = serde_json::from_slice(bytes).map_err(|_| "speech_uncertain")?;
    if !matches!(value["result"]["language"].as_str(), Some("es" | "en")) {
        return Err("speech_uncertain".into());
    }
    let segments = value["transcription"]
        .as_array()
        .filter(|items| !items.is_empty() && items.len() <= 128)
        .ok_or("no_speech")?;
    let mut text = String::new();
    let mut logs = 0.0;
    let mut count = 0;
    for segment in segments {
        let part = segment["text"].as_str().ok_or("speech_uncertain")?;
        if part.chars().any(|c| c.is_control() && !c.is_whitespace()) {
            return Err("speech_uncertain".into());
        }
        if !text.is_empty() {
            text.push(' ');
        }
        text.push_str(part.trim());
        let tokens = segment["tokens"].as_array().ok_or("speech_uncertain")?;
        for token in tokens {
            let id = token["id"].as_u64().ok_or("speech_uncertain")?;
            if id >= 50257 {
                continue;
            }
            let probability = token["p"]
                .as_f64()
                .filter(|p| p.is_finite() && *p >= 0.1 && *p <= 1.0)
                .ok_or("speech_uncertain")?;
            logs += probability.ln();
            count += 1;
            if count > 2048 {
                return Err("speech_uncertain".into());
            }
        }
    }
    if text.trim().is_empty()
        || text.chars().count() > 6000
        || count == 0
        || (logs / count as f64).exp() < 0.5
    {
        return Err("speech_uncertain".into());
    }
    Ok(text.trim().to_string())
}
fn memory_ready(available: u64) -> bool {
    available >= MEMORY_FLOOR + MODEL_BUDGET
}

#[derive(Default)]
struct SignalGate {
    voiced: usize,
    quiet: usize,
}
impl SignalGate {
    fn push(&mut self, samples: &[i16]) -> bool {
        let energy =
            samples.iter().map(|v| (*v as f64).powi(2)).sum::<f64>() / samples.len().max(1) as f64;
        if energy.sqrt() >= 327.0 {
            self.voiced += samples.len();
            self.quiet = 0;
        } else {
            self.quiet += samples.len();
        }
        self.has_speech() && self.quiet >= 19200
    }
    fn has_speech(&self) -> bool {
        self.voiced >= 4800
    }
}

#[cfg(windows)]
mod native;

#[tauri::command]
pub async fn voice_input_start(app: tauri::AppHandle, request_id: String) -> Result<(), String> {
    if uuid::Uuid::parse_str(&request_id).is_err() {
        return Err("invalid_speech_request".into());
    }
    #[cfg(windows)]
    {
        native::start(app, request_id)
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Err("speech_unavailable".into())
    }
}
#[tauri::command]
pub fn voice_input_finish(request_id: String) -> Result<(), String> {
    if uuid::Uuid::parse_str(&request_id).is_err() {
        return Err("invalid_speech_request".into());
    }
    #[cfg(windows)]
    native::finish(&request_id);
    Ok(())
}
#[tauri::command]
pub fn voice_input_cancel(request_id: String) -> Result<(), String> {
    if uuid::Uuid::parse_str(&request_id).is_err() {
        return Err("invalid_speech_request".into());
    }
    #[cfg(windows)]
    native::cancel(Some(&request_id));
    Ok(())
}
pub fn cancel_all() {
    #[cfg(windows)]
    native::cancel(None);
}
pub fn initialize() {
    #[cfg(windows)]
    native::cleanup();
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn delayed_audio_poll_keeps_submission_order_across_buffer_wrap() {
        let mut order = CaptureOrder::default();
        let mut ready = [true, true, false];
        assert_eq!(order.take(|i| ready[i]), Some(0));
        ready[0] = false;
        assert_eq!(order.take(|i| ready[i]), Some(1));
        // Buffer 2 was queued first; a delayed poll also finds newer 0 and 1 ready.
        ready = [true, true, true];
        assert_eq!(order.take(|i| ready[i]), Some(2));
        ready[2] = false;
        assert_eq!(order.take(|i| ready[i]), Some(0));
        ready[0] = false;
        assert_eq!(order.take(|i| ready[i]), Some(1));
        ready = [true, false, false];
        assert_eq!(order.take(|i| ready[i]), None);
    }
    #[test]
    fn pcm_is_bounded_and_encoded_as_mono_16khz_wav() {
        let data = wav(&[0, 32767, -32768]).unwrap();
        assert_eq!(&data[..4], b"RIFF");
        assert_eq!(u32::from_le_bytes(data[24..28].try_into().unwrap()), 16000);
        assert_eq!(&data[44..], &[0, 0, 255, 127, 0, 128]);
        assert!(wav(&[]).is_err());
        assert!(wav(&vec![0; MAX_SAMPLES + 1]).is_err());
    }
    #[test]
    fn final_text_requires_supported_language_and_confident_lexical_tokens() {
        let valid = br#"{"result":{"language":"es"},"transcription":[{"text":" Abre Chrome","tokens":[{"id":100,"p":0.9},{"id":101,"p":0.8}]}]}"#;
        assert_eq!(transcript(valid).unwrap(), "Abre Chrome");
        for value in [
            serde_json::json!({"result":{"language":"fr"},"transcription":[{"text":"ouvre", "tokens":[{"id":100,"p":0.9}]}]}),
            serde_json::json!({"result":{"language":"es"},"transcription":[{"text":"aprobar", "tokens":[{"id":100,"p":0.1}]}]}),
            serde_json::json!({"result":{"language":"es"},"transcription":[{"text":"inventado", "tokens":[]}]}),
            serde_json::json!({"result":{"language":"en"},"transcription":[]}),
        ] {
            assert!(transcript(&serde_json::to_vec(&value).unwrap()).is_err());
        }
        assert!(transcript(&vec![b' '; 256 * 1024 + 1]).is_err());
    }
    #[test]
    fn recognition_reserves_memory_for_the_operating_system() {
        assert!(!memory_ready(MEMORY_FLOOR + MODEL_BUDGET - 1));
        assert!(memory_ready(MEMORY_FLOOR + MODEL_BUDGET));
    }
    #[test]
    fn silence_and_brief_noise_never_become_a_spoken_request() {
        let mut gate = SignalGate::default();
        for _ in 0..10 {
            gate.push(&[0; 1600]);
        }
        assert!(!gate.has_speech());
        gate.push(&[2000; 1600]);
        assert!(!gate.has_speech());
        gate.push(&[2000; 1600]);
        gate.push(&[2000; 1600]);
        assert!(gate.has_speech());
        for _ in 0..11 {
            assert!(!gate.push(&[0; 1600]));
        }
        assert!(gate.push(&[0; 1600]));
    }
}
