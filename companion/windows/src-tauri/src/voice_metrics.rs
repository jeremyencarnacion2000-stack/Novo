use serde::Serialize;

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineTimings {
    pub resource_validation_ms: Option<u64>,
    pub microphone_prepare_ms: Option<u64>,
    pub capture_wall_ms: Option<u64>,
    pub capture_cleanup_ms: Option<u64>,
    pub audio_ms: Option<u64>,
    pub endpoint_quiet_ms: Option<u64>,
    pub endpoint_reason: Option<&'static str>,
    pub process_ms: Option<u64>,
    pub transcript_validation_ms: Option<u64>,
    pub native_total_ms: u64,
    pub engine: EngineTimings,
}

#[derive(Default, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineTimings {
    pub model_load_ms: Option<f64>,
    pub vad_ms: Option<f64>,
    pub mel_ms: Option<f64>,
    pub encode_ms: Option<f64>,
    pub decode_ms: Option<f64>,
    pub sample_ms: Option<f64>,
    pub batch_decode_ms: Option<f64>,
    pub prompt_ms: Option<f64>,
    pub engine_total_ms: Option<f64>,
}

pub fn engine_timings(stderr: &[u8]) -> EngineTimings {
    let mut result = EngineTimings::default();
    if stderr.len() > 65536 {
        return result;
    }
    let Ok(text) = std::str::from_utf8(stderr) else {
        return result;
    };
    for line in text.lines() {
        let (target, value) = if let Some(value) =
            line.strip_prefix("whisper_vad_detect_speech_no_reset: vad time =")
        {
            (&mut result.vad_ms, value)
        } else if let Some(value) = line.strip_prefix("whisper_print_timings:") {
            let Some((key, value)) = value.trim().split_once("time =") else {
                continue;
            };
            let target = match key.trim() {
                "load" => &mut result.model_load_ms,
                "mel" => &mut result.mel_ms,
                "encode" => &mut result.encode_ms,
                "decode" => &mut result.decode_ms,
                "sample" => &mut result.sample_ms,
                "batchd" => &mut result.batch_decode_ms,
                "prompt" => &mut result.prompt_ms,
                "total" => &mut result.engine_total_ms,
                _ => continue,
            };
            (target, value)
        } else {
            continue;
        };
        let Some(value) = value
            .split_whitespace()
            .next()
            .and_then(|v| v.parse::<f64>().ok())
        else {
            continue;
        };
        if value.is_finite() && (0.0..=60000.0).contains(&value) {
            *target = Some(value);
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_known_finite_engine_durations_survive_diagnostics() {
        let raw = b"private transcript and path\nwhisper_print_timings: load time = 609.58 ms\nwhisper_vad_detect_speech_no_reset: vad time = 162.33 ms processing 36800 samples\nwhisper_print_timings: encode time = 10346.75 ms / 1 runs\nwhisper_print_timings: decode time = NaN ms\nwhisper_print_timings: sample time = -1 ms\nwhisper_print_timings: total time = 12035.70 ms\n";
        let measured = engine_timings(raw);
        assert_eq!(measured.model_load_ms, Some(609.58));
        assert_eq!(measured.vad_ms, Some(162.33));
        assert_eq!(measured.encode_ms, Some(10346.75));
        assert_eq!(measured.decode_ms, None);
        assert_eq!(measured.sample_ms, None);
        assert_eq!(measured.engine_total_ms, Some(12035.70));
        let safe = serde_json::to_string(&measured).unwrap();
        assert!(!safe.contains("private") && !safe.contains("path"));
        assert!(engine_timings(&vec![b'x'; 65537]).model_load_ms.is_none());
    }
}
