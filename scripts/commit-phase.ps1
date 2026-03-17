param(
  [Parameter(Mandatory = $true)]
  [string]$Phase,

  [string]$ChecklistPath = "docs/execution-checklist.md",

  [switch]$RunChecks
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-GitRepo {
  $inside = git rev-parse --is-inside-work-tree 2>$null
  if ($LASTEXITCODE -ne 0 -or $inside -ne "true") {
    throw "Current directory is not inside a git repository."
  }
}

function Get-CheckedCount([string]$Path) {
  if (-not (Test-Path $Path)) { return 0 }
  $lines = Get-Content -Path $Path
  return @($lines | Where-Object { $_ -match '^\s*-\s*\[x\]\s+' }).Count
}

Ensure-GitRepo

if ($RunChecks) {
  if (Test-Path "client/package.json") {
    Write-Host "Running client checks..."
    Push-Location "client"
    try {
      npm run test:unit
      npm run lint
      npm run build
    }
    finally {
      Pop-Location
    }
  }

  if (Test-Path "server/package.json") {
    Write-Host "Running server checks..."
    Push-Location "server"
    try {
      npm run test
    }
    finally {
      Pop-Location
    }
  }
}

$checkedCount = Get-CheckedCount -Path $ChecklistPath
$phaseLabel = $Phase.Trim()
if (-not $phaseLabel) {
  throw "Phase cannot be empty."
}

git add -A

$hasChanges = (git diff --cached --name-only).Trim()
if (-not $hasChanges) {
  Write-Host "No staged changes detected. Nothing to commit."
  exit 0
}

$message = "chore(phase): $phaseLabel checkpoint"
if ($checkedCount -gt 0) {
  $message = "$message ($checkedCount todos complete)"
}

git commit -m $message
Write-Host "Committed: $message"
