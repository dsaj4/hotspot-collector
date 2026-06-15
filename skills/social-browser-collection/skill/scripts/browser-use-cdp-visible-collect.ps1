param(
  [string]$Platform = "bilibili",
  [int]$Port = 9223,
  [string]$Url = "https://www.bilibili.com/v/popular/all/",
  [ValidateSet("subscription", "search", "favorite", "hotspot", "home-feed")]
  [string]$StreamType = "hotspot",
  [int]$Limit = 8,
  [string]$Output = "data/demo/browser-use-visible-observation.json",
  [string]$Session = "hotspot-social"
)

$ErrorActionPreference = "Stop"

function Require-Command($Name, $InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is not available. $InstallHint"
  }
}

Require-Command "browser-use" "Install Browser Use CLI, then run: browser-use doctor"

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

Write-Host "Connecting browser-use session '$Session' to $cdpUrl ..."
browser-use --session $Session --cdp-url $cdpUrl open $Url | Out-Host
browser-use --session $Session state | Out-Host

$escapedPlatform = $Platform.Replace("\", "\\").Replace('"', '\"')
$escapedStreamType = $StreamType.Replace("\", "\\").Replace('"', '\"')
$escapedSourceId = "$Platform-browser-use-cdp"
$escapedSourceId = $escapedSourceId.Replace("\", "\\").Replace('"', '\"')

$js = @"
(() => {
  const limit = $Limit;
  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom >= 0 &&
      rect.top <= window.innerHeight &&
      rect.right >= 0 &&
      rect.left <= window.innerWidth;
  };
  const seen = new Set();
  const items = Array.from(document.querySelectorAll('a[href]'))
    .filter(isVisible)
    .map((anchor) => {
      const title = (anchor.innerText || anchor.getAttribute('title') || anchor.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
      const url = new URL(anchor.getAttribute('href'), location.href).href;
      return { title, url };
    })
    .filter((item) => item.title && /^https?:\/\//.test(item.url))
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .slice(0, limit);
  return JSON.stringify({
    sourceId: "$escapedSourceId",
    platform: "$escapedPlatform",
    streamType: "$escapedStreamType",
    pageUrl: location.href,
    status: items.length ? "ok" : "empty",
    capturedAt: new Date().toISOString(),
    items
  }, null, 2);
})()
"@

Write-Host "Extracting visible anchors with browser-use eval ..."
$raw = browser-use --session $Session eval $js
$text = ($raw -join "`n").Trim()

try {
  $parsed = $text | ConvertFrom-Json
  if ($parsed -is [string]) {
    $parsed = $parsed | ConvertFrom-Json
  }
} catch {
  throw "browser-use eval did not return valid BrowserObservation JSON. Raw output:`n$text"
}

$outputDir = Split-Path -Parent $Output
if ($outputDir) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

$parsed | ConvertTo-Json -Depth 20 | Set-Content -Path $Output -Encoding UTF8
Write-Host "Wrote BrowserObservation to $Output"
Write-Host "Next: npm.cmd run social:ingest -- --input=$Output"
