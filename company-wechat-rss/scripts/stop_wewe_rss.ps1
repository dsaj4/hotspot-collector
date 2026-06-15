Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PidPath = Join-Path $ProjectRoot "tmp\wewe-rss\server.pid"

if (-not (Test-Path -LiteralPath $PidPath)) {
  Write-Host "No PID file found. wewe-rss does not look like it is running."
  exit 0
}

$pidValue = Get-Content -LiteralPath $PidPath -ErrorAction SilentlyContinue
if (-not $pidValue) {
  Remove-Item -LiteralPath $PidPath -Force
  Write-Host "Empty PID file removed."
  exit 0
}

$process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
if ($process) {
  Stop-Process -Id $pidValue -Force
  Write-Host "Stopped wewe-rss process $pidValue"
}
else {
  Write-Host "PID $pidValue is not running."
}

Remove-Item -LiteralPath $PidPath -Force
