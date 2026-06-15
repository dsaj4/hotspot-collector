# Repository Guide

Updated: 2026-06-15

This guide is the quick map for the cleaned Hotspot Collector repository.

## Three Roots

```text
E:/Project/hotspot-collector/           source repository
E:/Project/hotspot-collector-data/      runtime data and generated outputs
E:/Project/hotspot-collector-external/  external forked applications
```

Only the source repository is committed here. Data and external apps are mounted locally.

## Source Repository Layout

```text
src/
  cli/            command-line entrypoint
  collection/     hotspot, subscription, and social collection
  core/           shared paths, storage, env, time, HTTP, secrets, browser helpers
  integrations/   external BiliSum and WeWe RSS integration clients/setup
  material-hub/   source digest, aggregation, material-card workflow
  reporting/      compatibility feed and daily-report commands
  scheduler/      one-shot scheduled task planning and execution
  sources/        source catalog and URL detection
  validation/     fixture and normalized-record validators
  video-notes/    Bilibili note intake through BiliSum
  workflows/      higher-level workflow composition

tests/            Vitest coverage organized by functional domain
fixtures/         redacted public fixtures only
config/           checked-in example config only
docs/             architecture, operations, integrations, requirements, migration notes
scripts/          local helper scripts
skills/           project-specific Codex skills only
```

Legacy Bilibili following/subtitle collector files have been removed. Bilibili URL acquisition now belongs to `social-browser-collection`, and video understanding belongs to the external BiliSum fork.

## External Applications

```text
E:/Project/hotspot-collector-external/BiliSum
E:/Project/hotspot-collector-external/wewe-rss
```

BiliSum:

```text
origin: https://github.com/dsaj4/BiliSum.git
branch: hotspot/ai-subtitle
```

WeWe RSS:

```text
origin: https://github.com/dsaj4/wewe-rss.git
branch: hotspot/wechat-official-account-adapter
```

These are separate Git repositories. Do not vendor them into `hotspot-collector`.

## Runtime Data

Runtime output goes under `HOTSPOT_DATA_ROOT`, recommended as:

```text
E:/Project/hotspot-collector-data
```

Logical artifact references remain stable:

```text
data/raw/...
data/normalized/...
data/health/...
reports/...
```

The physical files are written to the external data root by default.

## Maintained Workflows

Hotspots:

```text
npm.cmd run workflow:hotspots -- --stage=collect
npm.cmd run workflow:hotspots -- --stage=digest --mode=local-rule
npm.cmd run workflow:hotspots -- --stage=material --mode=deepseek
```

Subscriptions:

```text
npm.cmd run workflow:subscriptions -- --stage=collect
npm.cmd run workflow:subscriptions -- --stage=digest --mode=local-rule
npm.cmd run workflow:subscriptions -- --stage=material --mode=deepseek
```

Bilibili video notes:

```text
npm.cmd run video:bilisum-status
npm.cmd run video:setup-bilisum
npm.cmd run video:notes-bilibili -- --url=https://www.bilibili.com/video/BV1tfoNBqEtN
```

Official accounts:

```text
npm.cmd run collect:official-accounts
```

Material from a link:

```text
npm.cmd run material:from-link -- --url=https://example.com/article --content-file=E:\path\to\article.md --mode=deepseek
```

## Removed During Migration

These legacy built-in Bilibili entries are no longer available:

```text
discover:bilibili-followings
collect:subscriptions:followings
collect:bilibili-subtitles
bilibili-user-dynamic
bilibili-user-video
```

Use `social-browser-collection` for visible Bilibili URL selection and BiliSum for video understanding.

## Verification

Before committing source changes:

```text
npm.cmd run typecheck
npm.cmd test
npm.cmd run validate:fixtures
```

Before final push:

```text
npm.cmd run check
git status --short --branch
git status --ignored --short
```

## Rules

- Do not commit secrets, cookies, browser profiles, SQLite files, screenshots, video/audio files, generated notes, reports, or logs.
- Keep RSS/XML as compatibility output; normalized JSON/JSONL is the internal source of truth.
- Treat platform heat as a signal, not verified fact.
- Cookie-based sources require explicit local approval and must not be enabled by default.
- Do not bypass login walls, anti-bot controls, paywalls, or platform restrictions.
