# Current Project Status

Updated: 2026-06-15

This page summarizes the current repository state and the remaining migration work. Historical handoff details from the pre-migration layout were removed because they described vendored apps and in-repository runtime data.

## Repository

```text
path:   E:/Project/hotspot-collector
remote: https://github.com/dsaj4/hotspot-collector.git
branch: codex/project-structure-migration
```

The repository is a source and orchestration repo. It should contain code, tests, fixtures, config templates, docs, scripts, and project-specific skills.

Current branch status at the documentation pass:

```text
main repo: clean working tree before docs edits
BiliSum:   hotspot/ai-subtitle tracks origin/hotspot/ai-subtitle
WeWe RSS:  hotspot/wechat-official-account-adapter tracks origin/hotspot/wechat-official-account-adapter
```

## External Roots

Runtime data:

```text
E:/Project/hotspot-collector-data
```

External upstream-derived apps:

```text
E:/Project/hotspot-collector-external/BiliSum
E:/Project/hotspot-collector-external/wewe-rss
```

## External Repositories

BiliSum:

```text
origin:   https://github.com/dsaj4/BiliSum.git
upstream: https://github.com/lycohana/BiliSum.git
branch:   hotspot/ai-subtitle
head:     5f5767c test: cover bilibili ai subtitle fallback
```

WeWe RSS:

```text
origin:   https://github.com/dsaj4/wewe-rss.git
upstream: https://github.com/cooderl/wewe-rss.git
branch:   hotspot/wechat-official-account-adapter
heads:    0b5830f chore: ignore python cache files
          472f872 feat: add hotspot official account export
```

## Active Workflows

- Hotspot collection: `npm.cmd run workflow:hotspots -- --stage=collect`
- Subscription collection: `npm.cmd run workflow:subscriptions -- --stage=collect`
- Bilibili video notes: `npm.cmd run video:notes-bilibili -- --url=<bilibili-url>`
- Material card from link: `npm.cmd run material:from-link -- --url=<url>`
- Feed compatibility output: `npm.cmd run feed:generate`
- Scheduler one-shot run: `npm.cmd run schedule:run`

## Migration State

Completed:

- Git repository and migration branch are active.
- External data and dependency root support has been added.
- Runtime outputs are routed through the external data root by default on this workstation.
- External BiliSum and WeWe RSS checkout locations are documented.
- BiliSum is maintained as `dsaj4/BiliSum:hotspot/ai-subtitle`.
- BiliSum AI subtitle fallback is covered by external unit tests.
- WeWe RSS is maintained as `dsaj4/wewe-rss:hotspot/wechat-official-account-adapter`.
- WeWe RSS official-account export exists in the external fork.
- The old in-repository `company-wechat-rss/` wrapper has been deleted.
- Generic skills were removed from this repository; only project-specific skills remain.
- Old Bilibili dynamic/following/subtitle collectors, scheduler tasks, CLI commands, and vendored RSSWorker code have been deleted.
- Source and test files are organized by functional domain under `src/collection`, `src/integrations`, `src/video-notes`, `src/reporting`, and mirrored test folders.

Still in progress:

- Real smoke test with `BV1tfoNBqEtN`.

Known caution:

- A local service may already be listening on BiliSum port `3838`. Confirm it is running from `E:/Project/hotspot-collector-external/BiliSum`, not the old `.tmp-bilisum-analysis` runtime, before treating a video-note smoke test as valid.

Removed entries:

```text
discover:bilibili-followings
collect:subscriptions:followings
collect:bilibili-subtitles
src/vendor/rssworker-bilibili/
src/adapters/subscriptions/bilibili*.ts
```

## Verification

Use this before continuing migration work:

```text
npm.cmd run typecheck
npm.cmd test
git status --short --branch
```

Use this before final push:

```text
npm.cmd run check
git status --ignored --short
```

Expected final push target:

```text
https://github.com/dsaj4/hotspot-collector.git
branch: codex/project-structure-migration
```
