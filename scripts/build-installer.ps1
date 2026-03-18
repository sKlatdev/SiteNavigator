$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$portableDist = Join-Path $repoRoot 'dist'
$portableExe = Join-Path $portableDist 'sitenavigator-win.exe'
$installerOut = Join-Path $portableDist 'SiteNavigator-Setup.exe'
$installerScript = Join-Path $PSScriptRoot 'installer.nsi'
$installedLauncher = Join-Path $PSScriptRoot 'launcher-installed.vbs'

Push-Location $repoRoot
try {
  Write-Host 'Building portable executable before installer packaging...'
  npm run build:portable

  if (-not (Test-Path $portableExe)) {
    throw "Portable executable not found at $portableExe"
  }

  if (-not (Test-Path $installerScript)) {
    throw "Installer script not found at $installerScript"
  }

  if (-not (Test-Path $installedLauncher)) {
    throw "Installer launcher script not found at $installedLauncher"
  }

  $makensis = Get-Command makensis -ErrorAction SilentlyContinue
  if (-not $makensis) {
    throw @"
makensis was not found on PATH.
Install NSIS and restart your shell, then rerun this command.
Download: https://nsis.sourceforge.io/Download
"@
  }

  Write-Host "Using makensis: $($makensis.Source)"
  & $makensis.Source "/DREPO_ROOT=$repoRoot" "/DPORTABLE_EXE=$portableExe" $installerScript

  if (-not (Test-Path $installerOut)) {
    throw "Installer build did not produce expected output: $installerOut"
  }

  Write-Host "Installer created: $installerOut"
}
finally {
  Pop-Location
}