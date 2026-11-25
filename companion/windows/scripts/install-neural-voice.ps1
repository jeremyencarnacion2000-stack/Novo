param(
    [Parameter(Mandatory)][string] $Python,
    [Parameter(Mandatory)][string] $Assets
)
$ErrorActionPreference = 'Stop'
$verified = @{
    'kokoro-v1.0.int8.onnx' = '6E742170D309016E5891A994E1CE1559C702A2CCD0075E67EF7157974F6406CB'
    'voices-v1.0.bin' = 'BCA610B8308E8D99F32E6FE4197E7EC01679264EFED0CAC9140FE9C29F1FBF7D'
}
foreach ($name in $verified.Keys) {
    $source = Join-Path $Assets $name
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $source).Hash -ne $verified[$name]) {
        throw "Unexpected SHA-256 for $name"
    }
}
$extra = Join-Path $env:LOCALAPPDATA 'Novo Companion/voice-extra'
$runtime = Join-Path $extra 'runtime'
New-Item -ItemType Directory -Path $extra -Force | Out-Null
if (!(Test-Path -LiteralPath (Join-Path $runtime 'Scripts/python.exe'))) {
    & $Python -m venv $runtime
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
$worker = Join-Path $runtime 'Scripts/python.exe'
& $worker -m pip install --disable-pip-version-check --no-cache-dir -r (Join-Path $PSScriptRoot 'requirements-neural-voice.txt')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $worker -m pip check
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
foreach ($name in $verified.Keys) {
    Copy-Item -LiteralPath (Join-Path $Assets $name) -Destination (Join-Path $extra $name)
}
