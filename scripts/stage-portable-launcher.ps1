$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$distDir = Join-Path $repoRoot 'dist'
$portableExe = Join-Path $distDir 'sitenavigator-win.exe'
$launcherSource = Join-Path $PSScriptRoot 'launcher-portable.vbs'
$launcherDest = Join-Path $distDir 'SiteNavigator.vbs'

if (-not (Test-Path $portableExe)) {
  throw "Portable executable not found at $portableExe"
}

if (-not (Test-Path $launcherSource)) {
  throw "Portable launcher source not found at $launcherSource"
}

Copy-Item -Path $launcherSource -Destination $launcherDest -Force
Write-Host "Staged portable launcher: $launcherDest"
