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
    pub pcm: Option<PcmLevels>,
    pub native_total_ms: u64,
    pub engine: EngineTimings,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PcmLevels {
    pub rms_dbfs: Option<f64>,
    pub peak: u16,
    pub clipped_samples: usize,
}

pub fn pcm_levels(samples: &[i16]) -> Option<PcmLevels> {
    let mut power = 0.0;
    let mut peak = 0;
    let mut clipped_samples = 0;
    for &sample in samples {
        let magnitude = sample.unsigned_abs();
        power += f64::from(sample).powi(2);
        peak = peak.max(magnitude);
        clipped_samples += usize::from(magnitude >= 32760);
    }
    (!samples.is_empty()).then(|| PcmLevels {
        rms_dbfs: (power > 0.0)
            .then(|| 10.0 * (power / samples.len() as f64 / 32768.0_f64.powi(2)).log10()),
        peak,
        clipped_samples,
    })
}

#[derive(Default, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineTimings {
    pub model_load_ms: Option<f64>,
    pub vad_ms: Option<f64>,
    pub vad_segments: Option<u16>,
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
        if let Some(value) = line
            .strip_prefix("whisper_vad_segments_from_probs: Final speech segments after filtering:")
        {
            result.vad_segments = value.trim().parse().ok();
            continue;
        }
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
    fn pcm_diagnostics_report_levels_without_serializing_samples() {
        let signal = pcm_levels(&[-32768, 0, 32767, 1234]).unwrap();
        assert_eq!(signal.peak, 32768);
        assert_eq!(signal.clipped_samples, 2);
        assert!((-3.02..=-3.0).contains(&signal.rms_dbfs.unwrap()));
        assert_eq!(pcm_levels(&[0; 8]).unwrap().rms_dbfs, None);
        assert!(pcm_levels(&[]).is_none());
        assert!(!serde_json::to_string(&signal).unwrap().contains("1234"));
    }

    #[test]
    fn segment_count_distinguishes_zero_from_missing_and_rejects_bad_values() {
        let measured = engine_timings(
            b"whisper_vad_segments_from_probs: Final speech segments after filtering: 0\n",
        );
        assert_eq!(measured.vad_segments, Some(0));
        assert_eq!(engine_timings(b"unrelated: 2").vad_segments, None);
        assert_eq!(
            engine_timings(
                b"whisper_vad_segments_from_probs: Final speech segments after filtering: 65536\n"
            )
            .vad_segments,
            None
        );
    }
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
