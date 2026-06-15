param()

$ErrorActionPreference = "Stop"

$Command = $args
if (-not $Command -or $Command.Count -eq 0) {
  Write-Error "Usage: scripts/run-material-hub-with-secrets.ps1 -- npm.cmd run material:digest-sources -- --day=YYYY-MM-DD --limit=10"
}
if ($Command[0] -eq "--") {
  $Command = $Command[1..($Command.Count - 1)]
}

$runner = "C:\Users\Administrator\.secrets\run-authorized-project.ps1"
if (-not (Test-Path $runner)) {
  Write-Error "Secret runner not found: $runner"
}

$projectPath = Split-Path -Parent $PSScriptRoot
& $runner -ProjectPath $projectPath -Command $Command
exit $LASTEXITCODE
