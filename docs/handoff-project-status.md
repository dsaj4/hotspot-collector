# Current Project Status

Updated: 2026-06-15

This page summarizes the current migration target. Historical handoff details from the pre-migration layout were removed because they described vendored apps and in-repository runtime data.

## Repository

```text
path:   E:/Project/hotspot-collector
remote: https://github.com/dsaj4/hotspot-collector.git
branch: codex/project-structure-migration
```

The repository is a source and orchestration repo. It should contain code, tests, fixtures, config templates, docs, scripts, and project-specific skills.

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
```

WeWe RSS:

```text
origin:   https://github.com/dsaj4/wewe-rss.git
upstream: https://github.com/cooderl/wewe-rss.git
branch:   hotspot/wechat-official-account-adapter
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

Still in progress:

- BiliSum custom branch implementation for Bilibili AI subtitle fallback.
- WeWe RSS official-account export migration.
- Deletion of the old in-repository WeWe wrapper.
- Deletion of old Bilibili dynamic/following/subtitle collectors.
- Skill cleanup and source/test tree reorganization.
- Real smoke test with `BV1tfoNBqEtN`.

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
