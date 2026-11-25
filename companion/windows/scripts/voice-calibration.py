"""Opt-in Windows voice calibration. Fixed test phrases only; no network or app actions.
Audio is temporary; only --keep-audio retains it for another controlled comparison.
"""
import argparse
import ctypes as c
from ctypes import wintypes as w
import hashlib
import io
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

def engine_stages(text):
    if len(text) > 65536: return {}
    keys={'load':'model_load_ms','mel':'mel_ms','encode':'encode_ms','decode':'decode_ms',
        'sample':'sample_ms','batchd':'batch_decode_ms','prompt':'prompt_ms','total':'engine_total_ms'}
    result={}
    for line in text.splitlines():
        match=re.match(r'whisper_print_timings:\s*(\w+) time =\s*(\S+) ms',line)
        if match and match[1] in keys: key,value=keys[match[1]],match[2]
        else:
            match=re.match(r'whisper_vad_detect_speech_no_reset: vad time =\s*(\S+) ms',line)
            if not match: continue
            key,value='vad_ms',match[1]
        try: value=float(value)
        except ValueError: continue
        if math.isfinite(value) and 0<=value<=60000: result[key]=value
    return result

def bounded_context(audio_ms):
    if not math.isfinite(audio_ms) or not 0<audio_ms<=20000: raise ValueError('Invalid calibration duration')
    return min(1500,max(128,math.ceil((audio_ms+500)/2560)*128))

def recognition_metrics(value, expected):
    segments=value.get('transcription',[]);valid=isinstance(segments,list) and 0<len(segments)<=128
    text='';probabilities=[]
    if valid:
        for segment in segments:
            if not isinstance(segment,dict) or not isinstance(segment.get('text'),str) or not isinstance(segment.get('tokens'),list): valid=False;break
            text+=(' ' if text else '')+segment['text'].strip()
            for token in segment['tokens']:
                if not isinstance(token,dict) or type(token.get('id')) is not int or token['id']<0: valid=False;continue
                if token['id']>=50257: continue
                p=token.get('p')
                if type(p) not in (float,int) or not math.isfinite(p) or not 0<=p<=1: valid=False;continue
                if p<.1: valid=False
                probabilities.append(p)
    confidence=math.exp(sum(math.log(p) for p in probabilities)/len(probabilities)) if probabilities and min(probabilities)>0 else 0
    if len(text)>6000 or any(ord(ch)<32 and not ch.isspace() for ch in text): valid=False;text=''
    return dict(text=text,detected_language=value.get('result',{}).get('language'),confidence=confidence,
        passes_confidence_gate=bool(valid and text and probabilities and len(probabilities)<=2048 and confidence>=.5 and value.get('result',{}).get('language') in ('es','en')),
        exact_phrase=words(expected)==words(text),**word_errors(expected,text))

def prefix_wav(data, milliseconds):
    if not 0<milliseconds<=20000 or len(data)>1024**2: raise ValueError('Invalid prefix input')
    with wave.open(io.BytesIO(data),'rb') as wav:
        if (wav.getframerate(),wav.getnchannels(),wav.getsampwidth())!=(16000,1,2): raise ValueError('Expected PCM16 mono 16 kHz')
        frames=wav.readframes(min(wav.getnframes(),milliseconds*16))
    output=io.BytesIO()
    with wave.open(output,'wb') as wav:
        wav.setparams((1,2,16000,0,'NONE','not compressed'));wav.writeframes(frames)
    return output.getvalue()

def loaded_backends(text):
    return [name for name in ('CPU','BLAS','CUDA','Vulkan','OpenVINO') if 'loaded '+name+' backend' in text]

def verify_resources(resources, lock):
    # Diagnostic-only plugins from the pinned b5454 BLAS archive; production lock stays unchanged.
    extras=[{'name':'ggml-blas.dll','size':55296,'sha256':'3f33cc13fa48f75ea929422b9f25f4e722be9249035e709f08c3b65c13e0b088'},
        {'name':'libopenblas.dll','size':51126150,'sha256':'4c7fb23e900bd637cf771ad4ae3d1b51112a897385906433f2f1e58fe053ff70'}]
    files=lock['files']+[item for item in extras if (resources/item['name']).exists()]
    allowed={item['name'] for item in files}
    if any(path.name not in allowed or not path.is_file() for path in resources.iterdir()):raise ValueError('Unexpected voice resource')
    for item in files:
        path=resources/item['name']
        with path.open('rb') as stream:
            if path.stat().st_size!=item['size'] or hashlib.file_digest(stream,'sha256').hexdigest()!=item['sha256']:
                raise ValueError('Voice resource integrity mismatch')


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
        if not 0 < wav.getnframes() <= 320000:
            raise ValueError('Calibration audio must be between 0 and 20 seconds')
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


def compare(audio, language, expected, resources, directory, model_name='tiny', profile='baseline', repeats=1, models_dir=None):
    lock = json.loads((ROOT / 'voice-resources.lock.json').read_text(encoding='utf-8'))
    verify_resources(resources,lock)
    expected_hashes = {'tiny':'818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7',
        'base':'422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898',
        'small':'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb',
        'tiny-q8':'c2085835d3f50733e2ff6e4b41ae8a2b8d8110461e18821b09a15c40c42d1cca'}
    model_root = resources if model_name == 'tiny' else models_dir or ROOT/'.tmp'/'voice-calibration'
    model = model_root/('ggml-tiny-q8_0.bin' if model_name=='tiny-q8' else 'ggml-'+model_name+'-q5_1.bin')
    with model.open('rb') as stream:
        model_hash = hashlib.file_digest(stream, 'sha256').hexdigest()
    if model_hash != expected_hashes[model_name]:
        raise ValueError('Diagnostic model integrity mismatch')
    report = {'language': language, 'expected': expected, 'model':model.name, 'model_sha256':model_hash,
        'pcm': pcm_metrics(audio), 'variants': []}
    variants = [('current', 'auto', True, 5, 2, []), ('fixed-language', language, True, 5, 2, []),
            ('without-vad', language, False, 5, 2, []), ('greedy', language, False, 1, 2, [])]
    if profile == 'tune':
        vocabulary = ['--prompt', 'Novo, Codex, ClickHome.']
        variants = [('fixed-untrimmed', language, False, 5, 2, []),
            ('vocabulary', language, False, 5, 2, vocabulary),
            ('padded-vad', language, True, 5, 2, vocabulary + ['--vad-speech-pad-ms', '150']),
            ('fast-vocabulary', language, False, 1, 4, vocabulary)]
    if profile == 'context':
        variants = [('context-'+str(context), language, True, 1, 4,
            ['--prompt', 'Novo, Codex, ClickHome.', '--vad-speech-pad-ms', '150', '--audio-ctx', str(context)])
            for context in (512, 256, 128) if report['pcm']['audio_ms'] <= context*20]
    if profile in ('performance','screen'):
        context=['--audio-ctx',str(bounded_context(report['pcm']['audio_ms']))]
        variants=[('baseline',language,True,5,2,[]),('bounded-context',language,True,5,2,context)]
        if profile=='performance': variants += [
            ('one-thread',language,True,5,1,[]),('four-threads',language,True,5,4,[]),
            ('greedy-four',language,True,1,4,[]),('bounded-fast',language,True,1,4,context),
            ('padded-merged-vad',language,True,5,2,['--vad-speech-pad-ms','150','--vad-min-silence-duration-ms','300']),
            ('no-vad',language,False,5,2,[]),('flash-off',language,True,5,2,['--no-flash-attn']),
            ('gpu-auto',language,True,5,2,[])]
    if profile=='resident': variants=[('resident',language,True,5,2,['--max-context','0'])]
    if profile=='incremental':
        variants=[('prefix-'+str(ms),language,True,5,2,['--audio-ctx',str(bounded_context(ms))])
            for ms in (1000,2000) if ms<report['pcm']['audio_ms']]
        variants.append(('final',language,True,5,2,['--audio-ctx',str(bounded_context(report['pcm']['audio_ms']))]))
    report.update(profile=profile,repeats=repeats,cold_warm_note='Fresh model processes; OS file cache uncontrolled and resource hashing warms files. Resident profile reuses one model without text context.')
    variants=[(name,lang,vad,beam,threads,extra,iteration) for name,lang,vad,beam,threads,extra in variants
        for iteration in range(1,2 if profile=='resident' else repeats+1)]
    for configuration, lang, vad, beam, threads, extra, iteration in variants:
        name=configuration+'-run-'+str(iteration)
        free = available_memory()
        if free < FLOOR + 400 * 1024**2:
            item = {'variant': name, 'status': 'insufficient_memory', 'free_mib':free/1024**2}
            report['variants'].append(item); print(json.dumps(item), flush=True); break
        output = directory / name
        input_audio=audio
        if configuration.startswith('prefix-'):
            input_audio=directory/(name+'.wav')
            input_audio.write_bytes(prefix_wav(audio.read_bytes(),int(configuration.split('-')[1])))
        args = [str(resources / 'whisper-cli.exe')] + ([] if configuration=='gpu-auto' else ['--no-gpu']) + ['--threads', str(threads), '--processors', '1',
            '--beam-size', str(beam), '--language', lang, '--output-json-full', '--temperature', '0',
            '--temperature-inc', '0', '--logprob-thold', '-0.65', '--no-speech-thold', '0.6',
            '--model', str(model), '--file', str(input_audio), '--output-file', str(output)] + extra
        if vad: args += ['--vad', '--vad-model', str(resources / 'ggml-silero-v6.2.0.bin')]
        outputs=[output.with_suffix('.json')]
        if profile=='resident':
            for index in range(1,repeats):
                destination=directory/('resident-'+str(index))
                args+=['--file',str(audio),'--output-file',str(destination)]
                outputs.append(destination.with_suffix('.json'))
        completed_files={}
        started = time.monotonic(); peak = 0; minimum_free = available_memory(); status = 'completed'
        with output.with_suffix('.stderr').open('wb') as stderr, output.with_suffix('.stdout').open('wb') as stdout:
            process = subprocess.Popen(args, cwd=resources, stdout=stdout, stderr=stderr, creationflags=subprocess.CREATE_NO_WINDOW)
            while process.poll() is None:
                metrics = ProcessMemory(); metrics.size = c.sizeof(metrics)
                c.windll.psapi.GetProcessMemoryInfo(w.HANDLE(process._handle), c.byref(metrics), metrics.size)
                peak = max(peak, metrics.peak_ws); minimum_free = min(minimum_free, available_memory())
                for path in outputs:
                    if path.name in completed_files or not path.exists() or path.stat().st_size>256*1024: continue
                    try: json.loads(path.read_text(encoding='utf-8'))
                    except (ValueError,OSError): continue
                    completed_files[path.name]=round((time.monotonic()-started)*1000)
                if minimum_free < FLOOR or time.monotonic() - started > 60:
                    status = 'memory_guard' if minimum_free < FLOOR else 'timeout'; process.kill(); process.wait(); break
                time.sleep(.025)
        item = {'variant': name, 'status': status, 'elapsed_ms': round((time.monotonic()-started)*1000),
            'peak_working_set_mib': peak/1024**2, 'minimum_free_mib': minimum_free/1024**2, 'exit_code': process.returncode,
            'cpu_ms':cpu_time_ms(process), 'threads':threads,'beam':beam,'language':lang,'vad':vad,'extra':extra}
        item.update(configuration=configuration,iteration=iteration,fresh_process=True,partial_hypothesis_only=configuration.startswith('prefix-'))
        if item['cpu_ms'] is not None:
            item['average_cpu_core_equivalents']=item['cpu_ms']/max(1,item['elapsed_ms'])
            import os
            item['average_machine_cpu_percent']=100*item['average_cpu_core_equivalents']/max(1,os.cpu_count() or 1)
        if profile=='resident':
            results=[];ready=[]
            for path in outputs:
                try:
                    if path.stat().st_size>256*1024: raise ValueError('Oversized output')
                    value=json.loads(path.read_text(encoding='utf-8'))
                    results.append(recognition_metrics(value,expected));ready.append(completed_files.get(path.name,item['elapsed_ms']))
                except (OSError,ValueError): results.append({'passes_confidence_gate':False,'status':'missing_or_invalid_output'});ready.append(None)
            item['resident_results']=results
            item['result_ready_ms']=ready
            item['resident_intervals_ms']=[None if value is None else value-(ready[i-1] or 0) if i else value for i,value in enumerate(ready)]
            item['readiness_resolution_ms']=25
        result_path = output.with_suffix('.json')
        if status == 'completed' and process.returncode == 0 and result_path.exists() and result_path.stat().st_size <= 256*1024:
            value = json.loads(result_path.read_text(encoding='utf-8'))
            item.update(recognition_metrics(value,expected))
        item['vad_diagnostics'] = [line for line in output.with_suffix('.stderr').read_text(encoding='utf-8', errors='replace').splitlines()
            if re.search(r'VAD segment|Final speech segments|vad time|Including segment', line)][:20]
        item['inference_timings'] = [line for line in output.with_suffix('.stderr').read_text(encoding='utf-8', errors='replace').splitlines()
            if 'whisper_print_timings:' in line][:12]
        diagnostic=output.with_suffix('.stderr').read_text(encoding='utf-8',errors='replace')
        item['stages_ms']=engine_stages(diagnostic)
        item['loaded_backends']=loaded_backends(diagnostic)
        item['backend_features']={key:int(value) for key,value in re.findall(r'\b(AVX|AVX2|FMA|F16C|SSE3|SSSE3|VULKAN|BLAS|OPENVINO|CUDA)\s*=\s*([01])',diagnostic)}
        report['variants'].append(item); print(json.dumps(item, ensure_ascii=False), flush=True)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audio', type=Path); parser.add_argument('--capture', action='store_true')
    parser.add_argument('--device', type=int, default=0); parser.add_argument('--seconds', type=int, choices=range(5, 21), default=12)
    parser.add_argument('--language', choices=['es','en']); parser.add_argument('--expected')
    parser.add_argument('--resources', type=Path, default=ROOT/'resources'/'voice')
    parser.add_argument('--report', type=Path); parser.add_argument('--keep-audio', type=Path)
    parser.add_argument('--model', choices=['tiny','tiny-q8','base','small'], default='tiny')
    parser.add_argument('--profile', choices=['baseline','tune','context','performance','screen','resident','incremental'], default='baseline')
    parser.add_argument('--repeats',type=int,choices=range(1,6),default=1)
    parser.add_argument('--models-dir',type=Path,default=ROOT/'.tmp'/'voice-calibration')
    parser.add_argument('--self-test', action='store_true'); args = parser.parse_args()
    if args.self_test:
        assert word_errors('Mañana abre Codex', 'manana abre codex')['wer'] == 0
        assert word_errors('open Codex now', 'open now')['wer'] == 1/3
        assert c.sizeof(Memory) == 64 and c.sizeof(ProcessMemory) in (40, 72)
        with tempfile.TemporaryDirectory() as folder:
            audio = Path(folder)/'test.wav'
            with wave.open(str(audio),'wb') as wav:
                wav.setparams((1,2,16000,0,'NONE','not compressed'))
                wav.writeframes(array('h',[1000]*1600).tobytes())
            measured = pcm_metrics(audio)
            assert measured['audio_ms'] == 100 and measured['peak'] == 1000 and measured['clipped_ratio'] == 0
            with wave.open(str(audio),'wb') as wav:
                wav.setparams((1,2,16000,0,'NONE','not compressed')); wav.writeframes(bytes(21*32000))
            try: pcm_metrics(audio)
            except ValueError: pass
            else: raise AssertionError('Oversized calibration audio was accepted')
        print('Self-check passed'); return
    if not args.language or args.expected is None or not args.report or (not args.audio and not args.capture): parser.error('Audio/capture, language, expected and report are required')
    with tempfile.TemporaryDirectory(prefix='novo-voice-', dir=ROOT/'.tmp') as folder:
        directory = Path(folder); audio = args.audio.resolve() if args.audio else directory/'capture.wav'
        if args.capture:
            if available_memory() < FLOOR + 400*1024**2: raise RuntimeError('At least 912 MiB free required')
            print('Capture starts after the spoken cue in 10 seconds. Speak only the displayed test phrase.', flush=True); time.sleep(10)
            capture(audio, args.device, args.seconds)
        report = compare(audio, args.language, args.expected, args.resources.resolve(), directory, args.model, args.profile,args.repeats,args.models_dir.resolve())
        args.report.parent.mkdir(parents=True, exist_ok=True); args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        if args.capture and args.keep_audio: args.keep_audio.write_bytes(audio.read_bytes())


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
