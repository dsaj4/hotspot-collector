param(
  [string]$ServerOriginUrl = "http://127.0.0.1:4000",
  [string]$AuthCode = "123567",
  [string]$DatabaseUrl = "file:../data/wewe-rss.db",
  [string]$FeedMode = "fulltext",
  [switch]$SkipInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$VendorRoot = Join-Path $ProjectRoot "vendor\wewe-rss"
$ServerRoot = Join-Path $VendorRoot "apps\server"
$WebRoot = Join-Path $VendorRoot "apps\web"
$ServerPrismaRoot = Join-Path $ServerRoot "prisma"
$ServerPrismaSqliteRoot = Join-Path $ServerRoot "prisma-sqlite"
$ServerDataRoot = Join-Path $ServerRoot "data"
$RelativeDbPath = $DatabaseUrl.Replace("file:", "")
$ResolvedDbPath = [System.IO.Path]::GetFullPath((Join-Path $ServerPrismaRoot $RelativeDbPath))

if (-not (Test-Path -LiteralPath $VendorRoot)) {
  throw "Missing vendored wewe-rss source at $VendorRoot. Run the skill bootstrap script without --skip-clone first."
}

if (-not $ServerPrismaRoot.StartsWith($ServerRoot)) {
  throw "Refusing to update prisma directory outside the vendored server root."
}

New-Item -ItemType Directory -Force -Path $ServerDataRoot | Out-Null

if (Test-Path -LiteralPath $ServerPrismaRoot) {
  Remove-Item -LiteralPath $ServerPrismaRoot -Recurse -Force
}
Copy-Item -LiteralPath $ServerPrismaSqliteRoot -Destination $ServerPrismaRoot -Recurse

$serverEnv = @"
HOST=0.0.0.0
PORT=4000
DATABASE_URL=$DatabaseUrl
DATABASE_TYPE=sqlite
AUTH_CODE=$AuthCode
MAX_REQUEST_PER_MINUTE=60
FEED_MODE=$FeedMode
SERVER_ORIGIN_URL=$ServerOriginUrl
CRON_EXPRESSION=35 5,17 * * *
ENABLE_CLEAN_HTML=false
UPDATE_DELAY_TIME=60
PLATFORM_URL=https://weread.111965.xyz
"@

$webEnv = @"
VITE_SERVER_ORIGIN_URL=$ServerOriginUrl
"@

Set-Content -LiteralPath (Join-Path $ServerRoot ".env") -Value $serverEnv -Encoding UTF8
Set-Content -LiteralPath (Join-Path $WebRoot ".env") -Value $webEnv -Encoding UTF8

Push-Location $VendorRoot
try {
  if (-not $SkipInstall) {
    & corepack pnpm install
    if ($LASTEXITCODE -ne 0) {
      throw "pnpm install failed with exit code $LASTEXITCODE"
    }
  }

  & corepack pnpm --filter server exec prisma generate --schema prisma/schema.prisma
  if ($LASTEXITCODE -ne 0) {
    throw "prisma generate failed with exit code $LASTEXITCODE"
  }

  & python (Join-Path $PSScriptRoot "init_wewe_rss_sqlite.py") --db-path $ResolvedDbPath
  if ($LASTEXITCODE -ne 0) {
    throw "sqlite init failed with exit code $LASTEXITCODE"
  }

  & corepack pnpm run -r build
  if ($LASTEXITCODE -ne 0) {
    throw "pnpm build failed with exit code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}

Write-Host "Prepared local wewe-rss runtime."
Write-Host "Dashboard: $ServerOriginUrl/dash"
Write-Host "Server env: $(Join-Path $ServerRoot '.env')"
