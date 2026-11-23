"""Offline Novo speech worker. Reads one request and emits mono PCM16 at 24 kHz."""
import json
import os
import sys
from pathlib import Path

VOICES = {"ef_dora": "es", "em_alex": "es", "em_santa": "es",
          "af_heart": "en-us", "am_michael": "en-us", "bf_emma": "en-gb", "bm_george": "en-gb"}
MAX_SAMPLES = 24_000 * 60


def main():
    root = Path(sys.argv[1])
    payload = json.loads(sys.stdin.buffer.read(32_001))
    voice, text = payload["voice"], payload["text"]
    if voice not in VOICES or not isinstance(text, str) or not 0 < len(text) <= 6000:
        raise ValueError("invalid speech input")
    from psutil import virtual_memory
    if virtual_memory().available < 700 * 1024**2:
        raise RuntimeError("insufficient memory")
    os.environ["OMP_NUM_THREADS"] = "2"
    import numpy as np
    import onnxruntime as ort
    from kokoro_onnx import Kokoro

    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(root / "kokoro-v1.0.int8.onnx"), options, providers=["CPUExecutionProvider"])
    synth = Kokoro.from_session(session, str(root / "voices-v1.0.bin"))
    audio, rate = synth.create(text, voice=voice, lang=VOICES[voice])
    if rate != 24_000 or not 0 < len(audio) <= MAX_SAMPLES:
        raise ValueError("invalid audio length")
    sys.stdout.buffer.write((np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes())


if __name__ == "__main__":
    main()
