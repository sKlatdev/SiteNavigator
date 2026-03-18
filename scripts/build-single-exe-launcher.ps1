$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$distDir = Join-Path $repoRoot 'dist'
$coreExe = Join-Path $distDir 'sitenavigator-core.exe'
$finalExe = Join-Path $distDir 'sitenavigator-win.exe'
$launcherSource = Join-Path $PSScriptRoot 'PortableLauncher.cs'
$legacyLauncher = Join-Path $distDir 'SiteNavigator.vbs'

$candidates = @(
  (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
  (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
)
$csc = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $csc) {
  throw 'C# compiler was not found. Expected a .NET Framework csc.exe installation.'
}

if (-not (Test-Path $coreExe)) {
  throw "Portable core executable not found at $coreExe"
}

if (-not (Test-Path $launcherSource)) {
  throw "Launcher source not found at $launcherSource"
}

if (Test-Path $finalExe) {
  Remove-Item -Path $finalExe -Force
}

& $csc /nologo /target:winexe /optimize+ "/out:$finalExe" "/resource:$coreExe,SiteNavigator.Core.exe" $launcherSource
if ($LASTEXITCODE -ne 0) {
  throw "Launcher compilation failed with exit code $LASTEXITCODE"
}

Remove-Item -Path $coreExe -Force
if (Test-Path $legacyLauncher) {
  Remove-Item -Path $legacyLauncher -Force
}

Write-Host "Created single executable launcher: $finalExe"
