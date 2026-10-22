param([switch]$Backup)
$ErrorActionPreference = 'Stop'
$cafeWorkspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $cafeWorkspace
if (Test-Path -LiteralPath 'data/server.pid') {
  $cafePid = [int](Get-Content -LiteralPath 'data/server.pid')
  $cafeServer = Get-CimInstance Win32_Process -Filter "ProcessId = $cafePid"
  if ($cafeServer) {
    if ($cafeServer.Name -ne 'node.exe' -or $cafeServer.CommandLine -notmatch [regex]::Escape((Join-Path $cafeWorkspace 'scripts/launch.mjs'))) { throw 'PID file does not point to this cafe server' }
    Stop-Process -Id $cafePid
  }
}
if ($Backup) {
  $cafeBackup = Join-Path $cafeWorkspace ('data/audit-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  New-Item -ItemType Directory -Path $cafeBackup | Out-Null
  Copy-Item -LiteralPath 'data/database' -Destination $cafeBackup -Recurse
  Copy-Item -LiteralPath 'migrations' -Destination $cafeBackup -Recurse
  Write-Output "Database recovery copy: $cafeBackup"
}
$cafeProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList ('"' + (Join-Path $cafeWorkspace 'scripts/launch.mjs') + '"') -WorkingDirectory $cafeWorkspace -WindowStyle Hidden -RedirectStandardOutput 'data/server.log' -RedirectStandardError 'data/server-error.log' -PassThru
Set-Content -LiteralPath 'data/server.pid' -Value $cafeProcess.Id
Write-Output "Cafe server PID: $($cafeProcess.Id)"
& (Get-Command node).Source (Join-Path $PSScriptRoot 'wait-local.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Cafe server did not become ready. Check data/server-error.log.' }
