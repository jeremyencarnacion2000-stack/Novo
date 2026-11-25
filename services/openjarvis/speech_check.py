"""Measure OpenJarvis Faster-Whisper on an existing, authorized local WAV."""

import argparse
import json
import logging
import os
import time
import wave
from pathlib import Path

from runtime import load_upstream


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("wav", type=Path)
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--language", choices=("es", "en"), required=True)
    args = parser.parse_args()
    from psutil import Process, virtual_memory

    if virtual_memory().available < 912 * 1024**2:
        raise SystemExit("Insufficient available memory for the speech diagnostic")
    with args.wav.open("rb") as audio:
        if os.fstat(audio.fileno()).st_size > 641_024:
            raise SystemExit("WAV exceeds the 20-second diagnostic limit")
        with wave.open(audio, "rb") as pcm:
            if (pcm.getnchannels(), pcm.getsampwidth(), pcm.getframerate()) != (1, 2, 16_000):
                raise SystemExit("Expected mono PCM16 at 16 kHz")
            if not 0 < pcm.getnframes() <= 320_000:
                raise SystemExit("Expected up to 20 seconds of PCM")
        audio.seek(0)
        waveform = audio.read(641_025)
    model = args.model_dir.resolve(strict=True)
    if not (model / "model.bin").is_file() or not (model / "tokenizer.json").is_file():
        raise SystemExit("Provide an existing local CTranslate2 model and tokenizer")
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["OMP_NUM_THREADS"] = "2"
    logging.disable(logging.CRITICAL)
    load_upstream()
    wall, cpu = time.perf_counter(), time.process_time()
    from openjarvis.speech.faster_whisper import FasterWhisperBackend

    result = FasterWhisperBackend(str(model), device="cpu", compute_type="int8").transcribe(
        waveform, language=args.language
    )
    memory = Process().memory_info()
    print(json.dumps({
        "text": result.text,
        "segments": len(result.segments),
        "elapsedMs": round((time.perf_counter() - wall) * 1_000, 2),
        "cpuMs": round((time.process_time() - cpu) * 1_000, 2),
        "peakRssBytes": getattr(memory, "peak_wset", memory.rss),
    }, ensure_ascii=True))


if __name__ == "__main__":
    main()
