$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22.12 or newer, then run this script again.' }
if (-not (Test-Path -LiteralPath 'node_modules')) { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' } }
if (-not (Test-Path -LiteralPath '.env')) { & npm.cmd run setup; if ($LASTEXITCODE -ne 0) { throw 'Setup failed' } }
if (-not (Test-Path -LiteralPath 'dist/index.js')) { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Build failed' } }
$portTask = 5100
$portLineTask = Get-Content -LiteralPath '.env' | Where-Object { $_ -match '^PORT=\d+$' } | Select-Object -First 1
if ($portLineTask) { $portTask = [int]($portLineTask -replace '^PORT=', '') }
$launchTask = Join-Path $PSScriptRoot 'scripts/launch.mjs'
$listenerTask = Get-NetTCPConnection -LocalPort $portTask -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $listenerTask) {
  $processTask = Start-Process -FilePath (Get-Command node).Source -ArgumentList ('"' + $launchTask + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'data/server.log') -RedirectStandardError (Join-Path $PSScriptRoot 'data/server-error.log') -PassThru
  $processTask.Id | Set-Content -LiteralPath 'data/server.pid'
} else {
  $existingTask = Get-CimInstance Win32_Process -Filter "ProcessId = $($listenerTask.OwningProcess)"
  if ($existingTask.CommandLine -notmatch [regex]::Escape((Join-Path $PSScriptRoot 'dist/index.js')) -and $existingTask.CommandLine -notmatch [regex]::Escape($launchTask)) { throw "Port $portTask is occupied by a process that cannot be verified as this café application." }
}
& node (Join-Path $PSScriptRoot 'scripts/wait-local.mjs') $portTask
if ($LASTEXITCODE -ne 0) { throw 'The café server did not become ready. Check data/server-error.log.' }
Start-Process "http://localhost:$portTask/login"
Write-Host "Café menu is running at http://localhost:$portTask."
