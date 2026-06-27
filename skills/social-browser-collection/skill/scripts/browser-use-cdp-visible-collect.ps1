param(
  [string]$Platform = "bilibili",
  [int]$Port = 9223,
  [string]$Url = "https://www.bilibili.com/v/popular/all/",
  [ValidateSet("subscription", "search", "favorite", "hotspot", "home-feed")]
  [string]$StreamType = "hotspot",
  [int]$Limit = 8,
  [string]$Output = "data/demo/browser-use-visible-observation.json",
  [string]$Session = "hotspot-social",
  [switch]$BrowserUseOnly
)

$ErrorActionPreference = "Stop"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

function Test-Command($Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function ConvertFrom-JsonText($Text) {
  $trimmed = ($Text -join "`n").Trim()
  if (-not $trimmed) { return $null }
  if ($trimmed -match "(?s)^result:\s*(.+)$") {
    $trimmed = $Matches[1].Trim()
  }
  try {
    $parsed = $trimmed | ConvertFrom-Json
    if ($parsed -is [string]) { return $parsed | ConvertFrom-Json }
    return $parsed
  } catch {
    $start = $trimmed.IndexOf("{")
    $end = $trimmed.LastIndexOf("}")
    if ($start -ge 0 -and $end -gt $start) {
      return $trimmed.Substring($start, $end - $start + 1) | ConvertFrom-Json
    }
    return $null
  }
}

function ConvertFrom-BrowserUseJson($Text) {
  $trimmed = ($Text -join "`n").Trim()
  if (-not $trimmed) { return $null }
  try {
    if (-not $trimmed.StartsWith("{")) {
      $start = $trimmed.IndexOf("{")
      $end = $trimmed.LastIndexOf("}")
      if ($start -ge 0 -and $end -gt $start) {
        $trimmed = $trimmed.Substring($start, $end - $start + 1)
      }
    }
    $payload = $trimmed | ConvertFrom-Json
    if ($payload.success -and $payload.data -and $payload.data.result) {
      return $payload.data.result | ConvertFrom-Json
    }
  } catch {
    return $null
  }
  return $null
}

function Save-Observation($Observation, $Path) {
  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $outputDir = Split-Path -Parent $fullPath
  if ($outputDir) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
  }
  $json = $Observation | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText($fullPath, $json, [System.Text.UTF8Encoding]::new($false))
}

function Invoke-BrowserUse($Arguments) {
  $browserUse = Get-Command "browser-use" -ErrorAction Stop
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $browserUse.Source
  $startInfo.Arguments = (($Arguments | ForEach-Object {
    $argument = [string]$_
    if ($argument -notmatch '[\s"]') { return $argument }
    return '"' + ($argument -replace '(\\*)"', '$1$1\"' -replace '(\\+)$', '$1$1') + '"'
  }) -join " ")
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.StandardOutputEncoding = $utf8NoBom
  $startInfo.StandardErrorEncoding = $utf8NoBom
  $startInfo.Environment["PYTHONIOENCODING"] = "utf-8"
  $process = [System.Diagnostics.Process]::Start($startInfo)
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  $lines = @()
  if ($stdout) { $lines += ($stdout -split "\r?\n") }
  if ($stderr) { $lines += ($stderr -split "\r?\n") }
  if ($process.ExitCode -ne 0) {
    throw (($lines -join "`n").Trim())
  }
  return $lines
}

function Get-Adler32($Text) {
  $mod = 65521
  $a = 1
  $b = 0
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  foreach ($byte in $bytes) {
    $a = ($a + $byte) % $mod
    $b = ($b + $a) % $mod
  }
  return (($b -shl 16) -bor $a) -band 0xffffffff
}

function Get-BrowserUseSessionPort($Name) {
  $browserUseCommand = Get-Command "browser-use" -ErrorAction SilentlyContinue
  if ($browserUseCommand) {
    try {
      $pythonPath = Join-Path (Split-Path -Parent (Split-Path -Parent $browserUseCommand.Source)) "browser-use\Scripts\python.exe"
      $escapedName = $Name.Replace("\", "\\").Replace("'", "\'")
      $socketPath = & $pythonPath -c "from browser_use.skill_cli.utils import get_socket_path; print(get_socket_path('$escapedName'))" 2>$null
      $socketText = ($socketPath -join "`n").Trim()
      if ($socketText -match ":(\d+)$") {
        return [int]$Matches[1]
      }
    } catch {
      # Fall back to the local implementation below.
    }
  }
  return 49152 + ((Get-Adler32 $Name) % 16383)
}

function Test-TcpConnect($Port) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync("127.0.0.1", $Port)
    if (-not $task.Wait(300)) { return $false }
    return $client.Connected
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Test-TcpBind($Port) {
  $listener = $null
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    if ($null -ne $listener) { $listener.Stop() }
  }
}

function Resolve-BrowserUseSession($Name) {
  $port = Get-BrowserUseSessionPort $Name
  if (Test-TcpBind $port) {
    return @{ Name = $Name; IsRunning = $false }
  }
  if (Test-TcpConnect $port) {
    Write-Host "Reusing Browser Use session '$Name' on local daemon port $port."
    return @{ Name = $Name; IsRunning = $true }
  }

  for ($i = 1; $i -le 20; $i++) {
    $candidate = "$Name-$i"
    $candidatePort = Get-BrowserUseSessionPort $candidate
    if (Test-TcpBind $candidatePort) {
      Write-Host "Browser Use session '$Name' maps to occupied or unavailable local port $port; using '$candidate' on port $candidatePort instead."
      return @{ Name = $candidate; IsRunning = $false }
    }
  }

  throw "No bindable Browser Use session port found for $Name."
}

function Collect-WithDirectCdp() {
  if ($BrowserUseOnly) {
    throw "Browser Use-only mode is enabled; direct CDP fallback is disabled."
  }
  Write-Host "Falling back to project direct CDP collector ..."
  npm.cmd run browser:collect-social -- --platform=$Platform --stream=$StreamType --source="$Platform-browser-use-cdp" --port=$Port --url=$Url --limit=$Limit --output=$Output | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Direct CDP collector failed."
  }
  Write-Host "Wrote BrowserObservation to $Output via direct CDP fallback"
  Write-Host "Next: npm.cmd run social:ingest -- --input=$Output"
}

$env:PYTHONIOENCODING = "utf-8"
$hasBrowserUse = Test-Command "browser-use"

$cdpUrl = "http://127.0.0.1:$Port"

Write-Host "Opening project browser session on $cdpUrl ..."
npm.cmd run browser:cdp -- --platform=$Platform --port=$Port --url=$Url | Out-Host

for ($i = 0; $i -lt 20; $i++) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "$cdpUrl/json/version" -TimeoutSec 2
    if ($response.StatusCode -eq 200) { break }
  } catch {
    Start-Sleep -Milliseconds 500
  }
  if ($i -eq 19) { throw "CDP endpoint did not become ready at $cdpUrl." }
}

if (-not $hasBrowserUse) {
  Write-Host "browser-use is not available. Install Browser Use CLI, then run: browser-use doctor"
  Collect-WithDirectCdp
  exit 0
}

$resolvedSession = Resolve-BrowserUseSession $Session
$Session = $resolvedSession.Name
Write-Host "Connecting browser-use session '$Session' to $cdpUrl ..."
try {
  if ($resolvedSession.IsRunning) {
    Invoke-BrowserUse @("--session", $Session, "open", $Url) | Out-Host
  } else {
    Invoke-BrowserUse @("--session", $Session, "--cdp-url", $cdpUrl, "open", $Url) | Out-Host
  }
} catch {
  Write-Host "Browser Use attach failed: $($_.Exception.Message)"
  Collect-WithDirectCdp
  exit 0
}

try {
  Invoke-BrowserUse @("--session", $Session, "state") | Out-Host
} catch {
  Write-Host "Browser Use state failed; continuing to read-only eval: $($_.Exception.Message)"
}

$escapedSourceId = "$Platform-browser-use-cdp"

Write-Host "Extracting visible anchors with browser-use eval ..."
try {
  $debugJsPath = [System.IO.Path]::ChangeExtension([System.IO.Path]::GetFullPath($Output), ".browser-use-eval.js")
  npm.cmd run browser:extraction-script -- --platform=$Platform --stream=$StreamType --source=$escapedSourceId --method=browser-use-script --limit=$Limit --output=$debugJsPath | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to generate Browser Use extraction script."
  }
  $js = [System.IO.File]::ReadAllText($debugJsPath, $utf8NoBom)
  $raw = Invoke-BrowserUse @("--json", "--session", $Session, "eval", $js)
  $parsed = ConvertFrom-BrowserUseJson $raw
  if ($null -eq $parsed) {
    throw "browser-use eval did not return valid BrowserObservation JSON."
  }
} catch {
  $debugPath = [System.IO.Path]::ChangeExtension([System.IO.Path]::GetFullPath($Output), ".browser-use-eval.txt")
  if ($raw) {
    [System.IO.File]::WriteAllText($debugPath, ($raw -join "`n"), [System.Text.UTF8Encoding]::new($false))
    Write-Host "Browser Use eval raw output saved to $debugPath"
  }
  Write-Host "Browser Use eval failed: $($_.Exception.Message)"
  Collect-WithDirectCdp
  exit 0
}

Save-Observation $parsed $Output
Write-Host "Wrote BrowserObservation to $Output via Browser Use"
Write-Host "Next: npm.cmd run social:ingest -- --input=$Output"
