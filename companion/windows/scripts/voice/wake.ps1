param([string] $ProbeWave)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$available = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
$recognizer = $available | Where-Object { $_.Culture.TwoLetterISOLanguageName -eq 'es' } | Select-Object -First 1
if (-not $recognizer) {
    $recognizer = $available | Where-Object { $_.Culture.TwoLetterISOLanguageName -eq 'en' } | Select-Object -First 1
}
if (-not $recognizer) { exit 2 }
$engine = [System.Speech.Recognition.SpeechRecognitionEngine]::new($recognizer)
try {
    $grammar = [System.Speech.Recognition.GrammarBuilder]::new()
    $grammar.Culture = $recognizer.Culture
    $phrases = [System.Speech.Recognition.Choices]::new([string[]]@('Novo', 'nuevo', 'novio', 'Nova', 'November', 'Hello'))
    $grammar.Append($phrases)
    $engine.LoadGrammar([System.Speech.Recognition.Grammar]::new($grammar))
    if ($ProbeWave) { $engine.SetInputToWaveFile($ProbeWave) }
    else { $engine.SetInputToDefaultAudioDevice() }
    $result = $engine.Recognize([TimeSpan]::FromSeconds(20))
    if ($ProbeWave -and $result) {
        [Console]::Error.WriteLine(('recognized={0} confidence={1:F3}' -f $result.Text, $result.Confidence))
    }
    if ($result -and $result.Text -ieq 'Novo' -and $result.Confidence -ge 0.91) {
        [Console]::Write('novo')
    }
} finally {
    $engine.Dispose()
}
