# WeWe RSS Integration

WeWe RSS is maintained as an external fork, not as a submodule or vendored directory.

## Repository

```text
path:     E:/Project/hotspot-collector-external/wewe-rss
origin:   https://github.com/dsaj4/wewe-rss.git
upstream: https://github.com/cooderl/wewe-rss.git
branch:   hotspot/wechat-official-account-adapter
heads:    0b5830f chore: ignore python cache files
          472f872 feat: add hotspot official account export
```

The custom branch contains the standalone official-account export behavior needed by Hotspot Collector. Old local Prisma/schema drift from the previous wrapper should not be carried forward unless it is explicitly required.

## Configuration

```text
WEWE_RSS_PROJECT_ROOT=E:/Project/hotspot-collector-external/wewe-rss
WECHAT_RSS_BASE_URL=http://127.0.0.1:4000
WECHAT_RSS_FEEDS=all
WECHAT_RSS_LIMIT=30
```

## Domain Language

Use generic official-account wording:

```text
groups
group
official_account_articles.json
official_account_articles.csv
```

Avoid company-specific names in new docs and exports. Temporary compatibility with old `companies/company` input may exist during migration, but the target model is official accounts grouped by user intent.

## Hotspot Collector Role

Hotspot Collector consumes WeWe RSS feeds and writes normalized subscription records. It should not own the WeWe RSS application runtime.

Primary collection command:

```text
npm.cmd run collect:official-accounts
```

Compatibility alias:

```text
npm.cmd run collect:wechat
```

`collect:wechat` may remain as a one-cycle alias while callers are updated.

The external fork also contains a standalone export tool:

```text
E:/Project/hotspot-collector-external/wewe-rss/tools/hotspot-official-account-export
```

The tool exports:

```text
official_account_articles.json
official_account_articles.csv
```

External verification from the migration pass:

```text
python -m pytest tools/hotspot-official-account-export/test_official_account_export.py
```

Expected result:

```text
3 passed
```

## Boundaries

- WeWe RSS login and feed setup happen in the local WeWe RSS dashboard.
- Generated exports belong under `HOTSPOT_DATA_ROOT/wewe-rss` or `HOTSPOT_DATA_ROOT/official-accounts`.
- Do not commit WeWe RSS runtime data, SQLite files, logs, cookies, or dashboard sessions.
