"""Opt-in Windows voice calibration. Fixed test phrases only; no network or app actions.
Audio is temporary; only --keep-audio retains it for another controlled comparison.
"""
import argparse
import ctypes as c
from ctypes import wintypes as w
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import unicodedata
import wave
from array import array

ROOT = Path(__file__).resolve().parents[1]
FLOOR = 512 * 1024**2


class Memory(c.Structure):
    _fields_ = [('length', w.DWORD), ('load', w.DWORD)] + [(name, c.c_ulonglong) for name in
        ('total', 'available', 'page_total', 'page_available', 'virtual_total', 'virtual_available', 'extended')]


class ProcessMemory(c.Structure):
    _fields_ = [('size', w.DWORD), ('faults', w.DWORD)] + [(name, c.c_size_t) for name in
        ('peak_ws', 'ws', 'peak_paged', 'paged', 'peak_nonpaged', 'nonpaged', 'pagefile', 'peak_pagefile')]


def available_memory():
    status = Memory(); status.length = c.sizeof(status)
    if not c.windll.kernel32.GlobalMemoryStatusEx(c.byref(status)):
        raise RuntimeError('Cannot verify free memory')
    return status.available


def cpu_time_ms(process):
    values = [w.FILETIME() for _ in range(4)]
    if not c.windll.kernel32.GetProcessTimes(w.HANDLE(process._handle), *[c.byref(v) for v in values]):
        return None
    return sum((value.dwHighDateTime << 32) | value.dwLowDateTime for value in values[2:]) / 10000


def words(text):
    text = ''.join(ch for ch in unicodedata.normalize('NFD', text.lower()) if not unicodedata.combining(ch))
    return re.findall(r'\w+', text)


def word_errors(expected, actual):
    reference, hypothesis = words(expected), words(actual)
    row = list(range(len(hypothesis) + 1))
    for i, left in enumerate(reference, 1):
        next_row = [i]
        for j, right in enumerate(hypothesis, 1):
            next_row.append(min(row[j] + 1, next_row[j-1] + 1, row[j-1] + (left != right)))
        row = next_row
    return {'word_errors': row[-1], 'reference_words': len(reference), 'wer': row[-1] / max(1, len(reference))}


def pcm_metrics(audio):
    with wave.open(str(audio), 'rb') as wav:
        if (wav.getframerate(), wav.getnchannels(), wav.getsampwidth()) != (16000, 1, 2):
            raise ValueError('Expected 16 kHz mono PCM16')
        samples = array('h', wav.readframes(wav.getnframes()))
    if not samples:
        raise ValueError('Empty recording')
    rms = math.sqrt(sum(x*x for x in samples) / len(samples))
    # Same energy/silence criterion as SignalGate; this is diagnostic, not authorization.
    voiced = quiet = 0; cutoff = None; levels = []
    for offset in range(0, len(samples), 1600):
        chunk = samples[offset:offset+1600]
        energy = math.sqrt(sum(x*x for x in chunk) / len(chunk))
        levels.append(round(20 * math.log10(max(energy, 1) / 32768), 1))
        if energy >= 327:
            voiced += len(chunk); quiet = 0
        else:
            quiet += len(chunk)
        if cutoff is None and voiced >= 4800 and quiet >= 19200:
            cutoff = (offset + len(chunk)) / 16000
    return {'audio_ms': len(samples) / 16, 'rms_dbfs': 20 * math.log10(max(rms, 1) / 32768),
        'peak': max(abs(x) for x in samples), 'clipped_ratio': sum(abs(x) >= 32760 for x in samples) / len(samples),
        'energy_gate_cutoff_s': cutoff, 'rms_dbfs_per_100ms': levels}


def capture(audio, device, seconds):
    class Format(c.Structure):
        _pack_ = 2
        _fields_ = [('tag', w.WORD), ('channels', w.WORD), ('rate', w.DWORD), ('bytes', w.DWORD),
                    ('align', w.WORD), ('bits', w.WORD), ('extra', w.WORD)]
    class Header(c.Structure):
        _fields_ = [('data', c.c_void_p), ('length', w.DWORD), ('recorded', w.DWORD), ('user', c.c_size_t),
                    ('flags', w.DWORD), ('loops', w.DWORD), ('next', c.c_void_p), ('reserved', c.c_size_t)]
    api = c.windll.winmm; handle = c.c_void_p(); headers = []; buffers = []; prepared = 0
    fmt = Format(1, 1, 16000, 32000, 2, 16, 0)
    def check(code):
        if code: raise RuntimeError('WinMM error ' + str(code))
    def collect(index):
        header = headers[index]
        result.extend(c.string_at(header.data, min(header.recorded, 3200)))
    try:
        check(api.waveInOpen(c.byref(handle), device, c.byref(fmt), 0, 0, 0))
        for _ in range(3):
            buffer = c.create_string_buffer(3200); buffers.append(buffer)
            header = Header(c.addressof(buffer), 3200, 0, 0, 0, 0, None, 0); headers.append(header)
            check(api.waveInPrepareHeader(handle, c.byref(header), c.sizeof(header))); prepared += 1
            check(api.waveInAddBuffer(handle, c.byref(header), c.sizeof(header)))
        subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command',
            "$v=New-Object -ComObject SAPI.SpVoice; $v.Voice=$v.GetVoices('Language=C0A').Item(0); [void]$v.Speak('Te escucho. Ya.',0)"],
            check=True, creationflags=subprocess.CREATE_NO_WINDOW)
        check(api.waveInStart(handle)); print('MICROPHONE STARTED', flush=True)
        started = time.monotonic(); result = bytearray(); index = 0
        while time.monotonic() - started < seconds:
            while headers[index].flags & 1:
                collect(index); headers[index].recorded = 0
                check(api.waveInAddBuffer(handle, c.byref(headers[index]), c.sizeof(Header)))
                index = (index + 1) % len(headers)
            time.sleep(.01)
        check(api.waveInReset(handle))
        for _ in range(len(headers)):
            if headers[index].flags & 1: collect(index)
            index = (index + 1) % len(headers)
        with wave.open(str(audio), 'wb') as wav:
            wav.setparams((1, 2, 16000, 0, 'NONE', 'not compressed')); wav.writeframes(result[:seconds*32000])
    finally:
        if handle.value:
            api.waveInReset(handle)
            for header in headers[:prepared]: api.waveInUnprepareHeader(handle, c.byref(header), c.sizeof(Header))
            api.waveInClose(handle)


def compare(audio, language, expected, resources, directory, base=False, tune=False, context_sweep=False):
    lock = json.loads((ROOT / 'voice-resources.lock.json').read_text(encoding='utf-8'))
    for item in lock['files']:
        path = resources / item['name']
        if path.stat().st_size != item['size'] or hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
            raise ValueError('Voice resource integrity mismatch')
    model = ROOT/'.tmp'/'voice-calibration'/'ggml-base-q5_1.bin' if base else resources/'ggml-tiny-q5_1.bin'
    model_hash = hashlib.sha256(model.read_bytes()).hexdigest()
    if base and model_hash != '422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898':
        raise ValueError('Diagnostic Base model integrity mismatch')
    report = {'language': language, 'expected': expected, 'model':model.name, 'model_sha256':model_hash,
        'pcm': pcm_metrics(audio), 'variants': []}
    variants = [('current', 'auto', True, 5, 2, []), ('fixed-language', language, True, 5, 2, []),
            ('without-vad', language, False, 5, 2, []), ('greedy', language, False, 1, 2, [])]
    if tune:
        vocabulary = ['--prompt', 'Novo, Codex, ClickHome.']
        variants = [('fixed-untrimmed', language, False, 5, 2, []),
            ('vocabulary', language, False, 5, 2, vocabulary),
            ('padded-vad', language, True, 5, 2, vocabulary + ['--vad-speech-pad-ms', '150']),
            ('fast-vocabulary', language, False, 1, 4, vocabulary)]
    if context_sweep:
        variants = [('context-'+str(context), language, True, 1, 4,
            ['--prompt', 'Novo, Codex, ClickHome.', '--vad-speech-pad-ms', '150', '--audio-ctx', str(context)])
            for context in (512, 256)]
    for name, lang, vad, beam, threads, extra in variants:
        if available_memory() < FLOOR + 400 * 1024**2:
            report['variants'].append({'variant': name, 'status': 'insufficient_memory'}); break
        output = directory / name
        args = [str(resources / 'whisper-cli.exe'), '--no-gpu', '--threads', str(threads), '--processors', '1',
            '--beam-size', str(beam), '--language', lang, '--output-json-full', '--temperature', '0',
            '--temperature-inc', '0', '--logprob-thold', '-0.65', '--no-speech-thold', '0.6',
            '--model', str(model), '--file', str(audio), '--output-file', str(output)] + extra
        if vad: args += ['--vad', '--vad-model', str(resources / 'ggml-silero-v6.2.0.bin')]
        started = time.monotonic(); peak = 0; minimum_free = available_memory(); status = 'completed'
        with output.with_suffix('.stderr').open('wb') as stderr, output.with_suffix('.stdout').open('wb') as stdout:
            process = subprocess.Popen(args, cwd=resources, stdout=stdout, stderr=stderr, creationflags=subprocess.CREATE_NO_WINDOW)
            while process.poll() is None:
                metrics = ProcessMemory(); metrics.size = c.sizeof(metrics)
                c.windll.psapi.GetProcessMemoryInfo(w.HANDLE(process._handle), c.byref(metrics), metrics.size)
                peak = max(peak, metrics.peak_ws); minimum_free = min(minimum_free, available_memory())
                if minimum_free < FLOOR or time.monotonic() - started > 60:
                    status = 'memory_guard' if minimum_free < FLOOR else 'timeout'; process.kill(); process.wait(); break
                time.sleep(.025)
        item = {'variant': name, 'status': status, 'elapsed_ms': round((time.monotonic()-started)*1000),
            'peak_working_set_mib': peak/1024**2, 'minimum_free_mib': minimum_free/1024**2, 'exit_code': process.returncode,
            'cpu_ms':cpu_time_ms(process), 'threads':threads,'beam':beam,'language':lang,'vad':vad,'extra':extra}
        result_path = output.with_suffix('.json')
        if status == 'completed' and process.returncode == 0 and result_path.exists() and result_path.stat().st_size <= 256*1024:
            value = json.loads(result_path.read_text(encoding='utf-8'))
            segments = value.get('transcription', [])
            text = ' '.join(segment.get('text', '').strip() for segment in segments).strip()
            probabilities = [token.get('p', 0) for segment in segments for token in segment.get('tokens', []) if token.get('id', 50257) < 50257]
            confidence = math.exp(sum(math.log(max(p, 1e-20)) for p in probabilities)/len(probabilities)) if probabilities else 0
            item.update(text=text, detected_language=value.get('result', {}).get('language'), confidence=confidence,
                passes_confidence_gate=bool(text and probabilities and min(probabilities)>=.1 and confidence>=.5 and value.get('result', {}).get('language') in ('es','en')),
                exact_phrase=words(expected)==words(text),
                **word_errors(expected, text))
        item['vad_diagnostics'] = [line for line in output.with_suffix('.stderr').read_text(encoding='utf-8', errors='replace').splitlines()
            if re.search(r'VAD segment|Final speech segments|vad time|Including segment', line)][:20]
        item['inference_timings'] = [line for line in output.with_suffix('.stderr').read_text(encoding='utf-8', errors='replace').splitlines()
            if 'whisper_print_timings:' in line][:12]
        report['variants'].append(item); print(json.dumps(item, ensure_ascii=False), flush=True)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audio', type=Path); parser.add_argument('--capture', action='store_true')
    parser.add_argument('--device', type=int, default=0); parser.add_argument('--seconds', type=int, choices=range(5, 21), default=12)
    parser.add_argument('--language', choices=['es','en']); parser.add_argument('--expected')
    parser.add_argument('--resources', type=Path, default=ROOT/'resources'/'voice')
    parser.add_argument('--report', type=Path); parser.add_argument('--keep-audio', type=Path)
    parser.add_argument('--base', action='store_true'); parser.add_argument('--tune', action='store_true')
    parser.add_argument('--context-sweep', action='store_true')
    parser.add_argument('--self-test', action='store_true'); args = parser.parse_args()
    if args.self_test:
        assert word_errors('Mañana abre Codex', 'manana abre codex')['wer'] == 0
        assert word_errors('open Codex now', 'open now')['wer'] == 1/3
        assert c.sizeof(Memory) == 64 and c.sizeof(ProcessMemory) in (40, 72)
        print('Self-check passed'); return
    if not args.language or not args.expected or not args.report or (not args.audio and not args.capture): parser.error('Audio/capture, language, expected and report are required')
    with tempfile.TemporaryDirectory(prefix='novo-voice-', dir=ROOT/'.tmp') as folder:
        directory = Path(folder); audio = args.audio.resolve() if args.audio else directory/'capture.wav'
        if args.capture:
            if available_memory() < FLOOR + 400*1024**2: raise RuntimeError('At least 912 MiB free required')
            print('Capture starts after the spoken cue in 10 seconds. Speak only the displayed test phrase.', flush=True); time.sleep(10)
            capture(audio, args.device, args.seconds)
        report = compare(audio, args.language, args.expected, args.resources.resolve(), directory, args.base, args.tune, args.context_sweep)
        args.report.parent.mkdir(parents=True, exist_ok=True); args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        if args.capture and args.keep_audio: args.keep_audio.write_bytes(audio.read_bytes())


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
