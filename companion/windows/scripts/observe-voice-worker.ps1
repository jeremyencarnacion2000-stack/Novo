param([Parameter(Mandatory=$true)][int]$NovoProcessId,[Parameter(Mandatory=$true)][string]$Report,[string]$Fixture)
$ErrorActionPreference='Stop'
$deadline=[DateTime]::UtcNow.AddSeconds(180)
$observed=$null
Write-Output 'Waiting for the installed Companion speech worker; this observer does not open the microphone.'
while([DateTime]::UtcNow -lt $deadline -and -not $observed){
  foreach($candidate in @(Get-Process -Name whisper-cli -ErrorAction SilentlyContinue)){
    $info=Get-CimInstance Win32_Process -Filter "ProcessId=$($candidate.Id)"
    if($info.ParentProcessId -eq $NovoProcessId){$observed=$candidate;break}
  }
  if(-not $observed){Start-Sleep -Milliseconds 50}
}
if(-not $observed){ @{status='no_speech_worker_observed';parent=$NovoProcessId} | ConvertTo-Json | Set-Content -LiteralPath $Report; exit 0 }
$fixtureCaptured=$false
if($Fixture -and $info.CommandLine -match '--file\s+(?:"([^"]+)"|(\S+))'){
  $source=if($matches[1]){$matches[1]}else{$matches[2]}
  $privateRoot=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Novo Companion\voice-requests'))+[IO.Path]::DirectorySeparatorChar
  $resolvedSource=(Resolve-Path -LiteralPath $source).Path
  $resolvedDestination=[IO.Path]::GetFullPath((Join-Path (Get-Location) $Fixture))
  $diagnosticRoot=[IO.Path]::GetFullPath((Join-Path (Get-Location) '.tmp\voice-calibration'))+[IO.Path]::DirectorySeparatorChar
  if(-not $resolvedSource.StartsWith($privateRoot) -or [IO.Path]::GetFileName($resolvedSource) -ne 'recording.wav' -or -not $resolvedDestination.StartsWith($diagnosticRoot)){throw 'Unexpected calibration audio path'}
  Copy-Item -LiteralPath $resolvedSource -Destination $resolvedDestination
  $fixtureCaptured=$true
}
[void]$observed.Handle
$start=$observed.StartTime.ToUniversalTime();$peak=0;$cpu=0
while(-not $observed.HasExited -and [DateTime]::UtcNow -lt $deadline){
  try{$observed.Refresh();$peak=[Math]::Max($peak,$observed.PeakWorkingSet64);$cpu=$observed.TotalProcessorTime.TotalMilliseconds}catch{break}
  Start-Sleep -Milliseconds 25
}
$end=if($observed.HasExited){$observed.ExitTime.ToUniversalTime()}else{[DateTime]::UtcNow}
$result=[ordered]@{status=if($observed.HasExited){'completed'}else{'observer_timeout'};parent=$NovoProcessId;worker=$observed.Id;wallMs=($end-$start).TotalMilliseconds;peakWorkingSetMiB=$peak/1MB;cpuMsLastSample=$cpu;sampleMs=25;fixtureCaptured=$fixtureCaptured}
$result | ConvertTo-Json | Set-Content -LiteralPath $Report
$result | ConvertTo-Json
$observed.Dispose()
