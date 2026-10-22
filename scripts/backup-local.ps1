$ErrorActionPreference = 'Stop'
$cafeWorkspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $cafeWorkspace
$cafeBackup = Join-Path $cafeWorkspace ('data/publish-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$cafeWasRunning = $false
if (Test-Path -LiteralPath 'data/server.pid') {
  $cafePid = [int](Get-Content -LiteralPath 'data/server.pid')
  $cafeServer = Get-CimInstance Win32_Process -Filter "ProcessId = $cafePid"
  if ($cafeServer) {
    if ($cafeServer.Name -ne 'node.exe' -or $cafeServer.CommandLine -notmatch [regex]::Escape((Join-Path $cafeWorkspace 'scripts/launch.mjs'))) { throw 'PID is not this cafe server' }
    Stop-Process -Id $cafePid
    Wait-Process -Id $cafePid -ErrorAction SilentlyContinue
    $cafeWasRunning = $true
  }
}
try {
  New-Item -ItemType Directory -Path $cafeBackup | Out-Null
  foreach ($cafeEntry in @('data/database','data/uploads','migrations','server','shared','client','scripts','.env','package.json','package-lock.json','vite.config.ts','tsconfig.json')) {
    Copy-Item -LiteralPath $cafeEntry -Destination $cafeBackup -Recurse
  }
  Set-Content -LiteralPath (Join-Path $cafeBackup 'RESTORE.txt') -Value 'Private recovery copy. Stop server before restoring database/uploads into data/, restore .env and matching source/migrations, install packages, build, then restart. Never upload this backup as public assets.'
  Write-Output "Complete recovery copy: $cafeBackup"
} finally {
  if ($cafeWasRunning) { & (Join-Path $PSScriptRoot 'restart-local.ps1') }
}
