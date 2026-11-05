import importlib.util
from pathlib import Path
import unittest
import io
import wave
import tempfile
from array import array

spec = importlib.util.spec_from_file_location('calibration', Path(__file__).resolve().parents[1]/'scripts/voice-calibration.py')
calibration = importlib.util.module_from_spec(spec); spec.loader.exec_module(calibration)

class CalibrationMetrics(unittest.TestCase):
    def test_resource_verification_rejects_extra_loadable_libraries_and_modified_core(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);core=root/'whisper-cli.exe';core.write_bytes(b'abc')
            lock={'files':[{'name':'whisper-cli.exe','size':3,'sha256':'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'}]}
            calibration.verify_resources(root,lock)
            extra=root/'ggml-unknown.dll';extra.write_bytes(b'bad')
            with self.assertRaises(ValueError):calibration.verify_resources(root,lock)
            extra.unlink();core.write_bytes(b'xyz')
            with self.assertRaises(ValueError):calibration.verify_resources(root,lock)

    def test_incremental_prefix_contains_no_future_audio(self):
        source=io.BytesIO()
        with wave.open(source,'wb') as wav:
            wav.setparams((1,2,16000,0,'NONE','not compressed'));wav.writeframes(array('h',[1000]*16000+[-1000]*16000).tobytes())
        with wave.open(io.BytesIO(calibration.prefix_wav(source.getvalue(),1000)),'rb') as wav:
            self.assertEqual(wav.getnframes(),16000)
            self.assertEqual(set(array('h',wav.readframes(wav.getnframes()))),{1000})

    def test_backend_confirmation_keeps_only_backend_names(self):
        self.assertEqual(calibration.loaded_backends('load_backend: loaded CPU backend from C:/private/ggml.dll\nload_backend: loaded BLAS backend from C:/private/blas.dll'),['CPU','BLAS'])

    def test_final_recognition_metrics_keep_confidence_separate_from_text_accuracy(self):
        value={'result':{'language':'en'},'transcription':[{'text':'Open Codex.','tokens':[{'id':10,'p':.9}]}]}
        measured=calibration.recognition_metrics(value,'Open Codex')
        self.assertEqual(measured.get('confidence'),.9)
        self.assertTrue(measured.get('passes_confidence_gate'))
        self.assertTrue(measured.get('exact_phrase'))
        value['transcription'][0]['tokens'][0]['p']=.2
        measured=calibration.recognition_metrics(value,'Open Codex')
        self.assertFalse(measured['passes_confidence_gate'])
        self.assertTrue(measured['exact_phrase'])
        value['transcription'][0]['tokens']=[{'id':10,'p':.05},{'id':11,'p':.9}]
        measured=calibration.recognition_metrics(value,'Open Codex')
        self.assertAlmostEqual(measured['confidence'],(.05*.9)**.5)
        self.assertFalse(measured['passes_confidence_gate'])
        value['transcription'][0]['tokens'][0]['p']=0
        measured=calibration.recognition_metrics(value,'Open Codex')
        self.assertEqual(measured['confidence'],0)
        self.assertFalse(measured['passes_confidence_gate'])
        self.assertFalse(calibration.recognition_metrics({'transcription':[]},'')['passes_confidence_gate'])

    def test_stage_parser_drops_private_output_and_rejects_invalid_times(self):
        result = calibration.engine_stages('private spoken words\nwhisper_print_timings: load time = 609.58 ms\nwhisper_print_timings: encode time = 10346.75 ms / 1 runs\nwhisper_print_timings: decode time = NaN ms\nwhisper_vad_detect_speech_no_reset: vad time = 162.33 ms processing 36800 samples')
        self.assertEqual(result, {'model_load_ms':609.58,'encode_ms':10346.75,'vad_ms':162.33})

    def test_short_context_always_covers_the_complete_command(self):
        for duration in (100,2300,11998,20000):
            context = calibration.bounded_context(duration)
            self.assertGreaterEqual(context*20,duration)
            self.assertLessEqual(context,1500)
        self.assertEqual(calibration.bounded_context(2300),256)

if __name__ == '__main__': unittest.main()
