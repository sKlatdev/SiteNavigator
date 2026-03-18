param(
  [int]$Port = 8791,
  [int]$TimeoutSeconds = 45
)

$ErrorActionPreference = 'Stop'

function Invoke-WithRetry {
  param(
    [string]$Url,
    [int]$TimeoutSeconds,
    [string]$ExpectSubstring
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastError = $null
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
      $body = [string]$response.Content
      if ([string]::IsNullOrWhiteSpace($ExpectSubstring) -or $body.Contains($ExpectSubstring)) {
        return $body
      }
      $lastError = "Response from $Url did not contain expected text '$ExpectSubstring'."
    }
    catch {
      $lastError = $_.Exception.Message
    }

    Start-Sleep -Milliseconds 500
  }

  throw "Timed out waiting for $Url. Last error: $lastError"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$distDir = Join-Path $repoRoot 'dist'
$portableExe = Join-Path $distDir 'sitenavigator-win.exe'
$dataDir = Join-Path $distDir 'data'
$indexPath = Join-Path $dataDir 'index.json'

if (-not (Test-Path $portableExe)) {
  throw "Portable executable not found at $portableExe. Run 'npm run build:portable' first."
}

if (Test-Path $dataDir) {
  Remove-Item -Recurse -Force $dataDir
}

$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = $portableExe
$startInfo.WorkingDirectory = $distDir
$startInfo.UseShellExecute = $false
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
$startInfo.Environment['PORT'] = "$Port"
$startInfo.Environment['SITENAVIGATOR_OPEN_BROWSER'] = 'false'

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $startInfo

if (-not $proc.Start()) {
  throw 'Failed to start portable executable process.'
}

$stderrReader = $proc.StandardError

try {
  Write-Host "Started portable executable PID=$($proc.Id) on port $Port"

  $healthBody = Invoke-WithRetry -Url "http://localhost:$Port/api/health" -TimeoutSeconds $TimeoutSeconds -ExpectSubstring '"ok":true'
  Write-Host "Health check passed: $healthBody"

  $htmlBody = Invoke-WithRetry -Url "http://localhost:$Port/" -TimeoutSeconds $TimeoutSeconds -ExpectSubstring '<div id="root"></div>'
  Write-Host "Root HTML check passed (length=$($htmlBody.Length))"

  $pathInfoRaw = Invoke-WithRetry -Url "http://localhost:$Port/api/index/path-info" -TimeoutSeconds $TimeoutSeconds -ExpectSubstring 'currentIndexPath'
  $pathInfo = $pathInfoRaw | ConvertFrom-Json
  $expectedPath = (Join-Path $distDir 'data\index.json')
  if ($pathInfo.currentIndexPath -ne $expectedPath) {
    throw "Expected packaged index path '$expectedPath' but got '$($pathInfo.currentIndexPath)'"
  }
  Write-Host "Index path check passed: $($pathInfo.currentIndexPath)"

  $null = Invoke-WithRetry -Url "http://localhost:$Port/api/content" -TimeoutSeconds $TimeoutSeconds -ExpectSubstring '"ok":true'
  if (-not (Test-Path $indexPath)) {
    throw "Expected local index file was not created at $indexPath"
  }
  Write-Host "Local index file created: $indexPath"
}
finally {
  if (-not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force
  }
}

Write-Host 'Portable smoke test passed.'