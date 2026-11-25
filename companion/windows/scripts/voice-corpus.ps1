param([string]$Output='.tmp/voice-calibration/optimization-corpus')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Speech
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$directory=[IO.Path]::GetFullPath((Join-Path $root $Output))
if(-not $directory.StartsWith((Join-Path $root '.tmp')+[IO.Path]::DirectorySeparatorChar)){throw 'Use a temporary diagnostic directory'}
[void][IO.Directory]::CreateDirectory($directory)
$samples=@(
 @{id='es-short';language='es';voice='Microsoft Helena Desktop';expected='Abre la calculadora.'},
 @{id='es-project';language='es';voice='Microsoft Helena Desktop';expected='Abre Codex.'},
 @{id='es-long';language='es';voice='Microsoft Helena Desktop';expected='Novo, abre Codex y continuemos con ClickHome. Primero revisa las tareas pendientes del proyecto y dime por dónde seguimos.'},
 @{id='es-general';language='es';voice='Microsoft Helena Desktop';expected='Mañana tengo una reunión a las nueve y después voy a revisar mis tareas.'},
 @{id='en-short';language='en';voice='Microsoft David Desktop';expected='Open the calculator.'},
 @{id='en-project';language='en';voice='Microsoft David Desktop';expected='Open Codex.'},
 @{id='en-long';language='en';voice='Microsoft David Desktop';expected='Novo, open Codex and continue with ClickHome. First review the pending project tasks and tell me what to do next.'},
 @{id='en-general';language='en';voice='Microsoft David Desktop';expected='Tomorrow I have a meeting at nine and then I will review my tasks.'}
)
$synth=New-Object System.Speech.Synthesis.SpeechSynthesizer
try{
 $format=New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
 foreach($sample in $samples){
  $sample.file=$sample.id+'.wav';$sample.kind='synthetic-speech-not-human'
  $path=Join-Path $directory $sample.file
  $synth.SelectVoice($sample.voice);$synth.SetOutputToWaveFile($path,$format);$synth.Speak($sample.expected);$synth.SetOutputToNull()
  $bytes=[IO.File]::ReadAllBytes($path)
  if($bytes.Length -lt 44 -or [Text.Encoding]::ASCII.GetString($bytes,0,4) -ne 'RIFF' -or [BitConverter]::ToUInt32($bytes,24) -ne 16000){throw 'Invalid synthesized PCM reference'}
  $sample.sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
 }
}finally{$synth.Dispose()}
@{provenance='Windows synthesis; no microphone or speaker playback';samples=$samples} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $directory 'corpus.json') -Encoding utf8
Write-Output "Created $($samples.Count) synthetic references; not physical acceptance."
