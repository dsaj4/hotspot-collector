param(
  [string]$BaseUrl = "http://127.0.0.1:4000",
  [switch]$Foreground
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$VendorRoot = Join-Path $ProjectRoot "vendor\wewe-rss"
$TmpRoot = Join-Path $ProjectRoot "tmp\wewe-rss"
$PidPath = Join-Path $TmpRoot "server.pid"
$LogPath = Join-Path $TmpRoot "server.log"

if (-not (Test-Path -LiteralPath $VendorRoot)) {
  throw "Missing vendored wewe-rss source at $VendorRoot. Run the skill bootstrap script first."
}

New-Item -ItemType Directory -Force -Path $TmpRoot | Out-Null

if ($Foreground) {
  Push-Location $VendorRoot
  try {
    & corepack pnpm --filter server start:prod
    exit $LASTEXITCODE
  }
  finally {
    Pop-Location
  }
}

if (Test-Path -LiteralPath $PidPath) {
  $existingPid = Get-Content -LiteralPath $PidPath -ErrorAction SilentlyContinue
  if ($existingPid) {
    $existingProcess = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
    if ($existingProcess) {
      Write-Host "wewe-rss is already running with PID $existingPid"
      Write-Host "Dashboard: $BaseUrl/dash"
      exit 0
    }
  }
}

$command = "Set-Location -LiteralPath '$VendorRoot'; & corepack pnpm --filter server start:prod *>> '$LogPath'"
$process = Start-Process `
  -FilePath "powershell.exe" `
  -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $command `
  -PassThru `
  -WindowStyle Hidden

Set-Content -LiteralPath $PidPath -Value $process.Id -Encoding UTF8
Start-Sleep -Seconds 5

try {
  Invoke-WebRequest -Uri "$BaseUrl/feeds/" -UseBasicParsing | Out-Null
  Write-Host "wewe-rss started successfully."
}
catch {
  Write-Warning "wewe-rss process started, but the health check is not ready yet. Check $LogPath"
}

Write-Host "PID: $($process.Id)"
Write-Host "Dashboard: $BaseUrl/dash"
Write-Host "Log: $LogPath"
