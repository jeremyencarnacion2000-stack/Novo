$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$shell = New-Object -ComObject Shell.Application
@($shell.Namespace('shell:AppsFolder').Items() | Select-Object -First 1024 | ForEach-Object {
  [pscustomobject]@{name=$_.Name; identity=$_.Path; target=$_.ExtendedProperty('System.Link.TargetParsingPath')}
}) | ConvertTo-Json -Compress -Depth 3
