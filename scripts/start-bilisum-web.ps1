$ErrorActionPreference = "Stop"

$repo = "E:\Project\hotspot-collector"
$url = "http://127.0.0.1:3838/"
$dataRoot = if ([string]::IsNullOrWhiteSpace($env:HOTSPOT_DATA_ROOT)) { "E:\Project\hotspot-collector-data" } else { $env:HOTSPOT_DATA_ROOT }
$profileDir = Join-Path $dataRoot "sessions\bilisum-web\profile"
$debugPort = 9383

function Test-BiliSumHealth {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "$url`health" -TimeoutSec 3
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Get-BiliSumAccessToken {
  $configPath = Join-Path $dataRoot "secrets\bilisum.json"
  if (-not (Test-Path $configPath)) {
    throw "BiliSum local config not found: $configPath"
  }

  $config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
  $token = [string]$config.accessToken
  if ([string]::IsNullOrWhiteSpace($token)) {
    throw "BiliSum access token is missing from local config."
  }
  return $token
}

function Get-BrowserPath {
  $candidates = @(
    $env:BROWSER_EXECUTABLE_PATH,
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
  ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  throw "Chrome or Edge was not found. Set BROWSER_EXECUTABLE_PATH to a browser executable."
}

function Invoke-CdpCommand {
  param(
    [Parameter(Mandatory = $true)][string]$WebSocketUrl,
    [Parameter(Mandatory = $true)][string]$Method,
    [hashtable]$Params = @{}
  )

  $socket = [System.Net.WebSockets.ClientWebSocket]::new()
  $ct = [Threading.CancellationToken]::None
  try {
    $socket.ConnectAsync([Uri]$WebSocketUrl, $ct).GetAwaiter().GetResult()
    $payload = @{ id = 1; method = $Method; params = $Params } | ConvertTo-Json -Depth 20 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
    $socket.SendAsync([ArraySegment[byte]]::new($bytes), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).GetAwaiter().GetResult()

    do {
      $chunks = New-Object System.Collections.Generic.List[byte]
      do {
        $buffer = [byte[]]::new(65536)
        $segment = [ArraySegment[byte]]::new($buffer)
        $result = $socket.ReceiveAsync($segment, $ct).GetAwaiter().GetResult()
        for ($i = 0; $i -lt $result.Count; $i++) {
          $chunks.Add($buffer[$i])
        }
      } while (-not $result.EndOfMessage)

      $message = [Text.Encoding]::UTF8.GetString($chunks.ToArray()) | ConvertFrom-Json
    } while ($message.id -ne 1)

    if ($message.error) {
      throw ($message.error | ConvertTo-Json -Compress)
    }
    return $message.result
  } finally {
    $socket.Dispose()
  }
}

function Start-BiliSumBrowser {
  $browserPath = Get-BrowserPath
  New-Item -ItemType Directory -Force -Path $profileDir | Out-Null

  $versionUrl = "http://127.0.0.1:$debugPort/json/version"
  $listUrl = "http://127.0.0.1:$debugPort/json/list"
  try {
    Invoke-WebRequest -UseBasicParsing -Uri $versionUrl -TimeoutSec 2 | Out-Null
  } catch {
    Start-Process -FilePath $browserPath -ArgumentList @(
      "--remote-debugging-port=$debugPort",
      "--user-data-dir=$profileDir",
      "--no-first-run",
      "--new-window",
      "--start-maximized",
      "about:blank"
    ) | Out-Null
  }

  $deadline = (Get-Date).AddSeconds(20)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -UseBasicParsing -Uri $versionUrl -TimeoutSec 2 | Out-Null
      $targets = Invoke-RestMethod -Uri $listUrl -TimeoutSec 2
      $pageTarget = $targets | Where-Object { $_.type -eq "page" } | Select-Object -First 1
      if ($pageTarget -and $pageTarget.webSocketDebuggerUrl) {
        return [string]$pageTarget.webSocketDebuggerUrl
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  throw "Timed out waiting for BiliSum browser DevTools endpoint."
}

if (-not (Test-BiliSumHealth)) {
  Push-Location $repo
  try {
    npm.cmd run video:setup-bilisum | Out-Null
  } finally {
    Pop-Location
  }
}

$token = Get-BiliSumAccessToken
$browserWebSocket = Start-BiliSumBrowser

$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
  if (Test-BiliSumHealth) {
    Invoke-CdpCommand -WebSocketUrl $browserWebSocket -Method "Network.enable" | Out-Null
    Invoke-CdpCommand -WebSocketUrl $browserWebSocket -Method "Network.setCookie" -Params @{
      name = "bilisum_session"
      value = $token
      domain = "127.0.0.1"
      path = "/"
      httpOnly = $true
      secure = $false
      sameSite = "Strict"
      expires = [int64]([DateTimeOffset]::Now.AddDays(30).ToUnixTimeSeconds())
    } | Out-Null
    Invoke-CdpCommand -WebSocketUrl $browserWebSocket -Method "Page.navigate" -Params @{ url = $url } | Out-Null
    Invoke-CdpCommand -WebSocketUrl $browserWebSocket -Method "Page.bringToFront" | Out-Null
    exit 0
  }
  Start-Sleep -Seconds 1
}

Invoke-CdpCommand -WebSocketUrl $browserWebSocket -Method "Page.navigate" -Params @{ url = $url } | Out-Null
Invoke-CdpCommand -WebSocketUrl $browserWebSocket -Method "Page.bringToFront" | Out-Null
exit 1
