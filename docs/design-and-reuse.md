# Design And Reuse

Updated: 2026-06-15

This project follows the installed Karpathy-style engineering guidelines: state assumptions, keep implementation verifiable, preserve raw evidence, and represent unstable sources as source health instead of fake success.

## Objective

Build a sustainable orchestration repository for:

- Platform subscriptions: RSS, official-account feeds, browser-observed social items, and future explicit RSSHub/browser-session sources.
- Platform hotspots: hot lists, search trends, and technical/community trends.
- Bilibili video understanding through the external BiliSum fork.
- Material cards and optional explicit IMA sync.

Runtime data and upstream-derived applications are deliberately externalized.

## Current Scope

### Subscriptions

- Bilibili: target path is URL acquisition through `social-browser-collection`, then video understanding through the external BiliSum fork.
- WeChat official accounts: consumes a local WeWe RSS service from the external WeWe RSS fork. The main collector reads `/feeds/<feed>.json` and falls back to `/feeds/<feed>.rss`.
- Generic RSS and YouTube: source-catalog-driven direct RSS subscriptions, with YouTube using native channel RSS.
- RSSHub compatibility: source-catalog-driven routes for Infohub-style X/Twitter, Weibo, Zhihu, and Bilibili subscriptions.
- X: official API v2 support has been removed because API credentials are not available. Future support should be rebuilt from Infohub-style RSSHub or browser-session paths.
- Xiaohongshu: removed from this phase; revisit only after a separate access and risk review.

### Hotspots

Implemented sources:

1. Bilibili popular
2. Weibo hot search
3. Zhihu hot list
4. Douyin hot search
5. Baidu hot search
6. GitHub Trending
7. Hacker News front page
8. Google News AI RSS

X recent search via official API has been removed from the hotspot collector.

## Architecture

```text
collection
  |-- subscriptions
  |     |-- rss
  |     |-- rsshub
  |     |-- browser-session
  |
  |-- hotspots
  |     |-- adapters
  |
  |-- social
        |-- ingest browser observations
        |-- fallback public hotspot adapters

integrations
  |-- bilisum
  |-- wewe-rss

video-notes
  |-- bilibili

scheduler
  |-- plan due tasks
  |-- run due tasks once
  |-- persist task state

storage
  |-- HOTSPOT_DATA_ROOT/raw/<date>/*.json
  |-- HOTSPOT_DATA_ROOT/normalized/<date>/*.jsonl
  |-- HOTSPOT_DATA_ROOT/health/source-health.json
  |-- HOTSPOT_DATA_ROOT/scheduler/state.json
  |-- HOTSPOT_DATA_ROOT/secrets/*.json
  |-- HOTSPOT_DATA_ROOT/sessions/<platform>/

compatibility output
  |-- reports/feeds/subscriptions.rss
  |-- reports/feeds/subscriptions.json
  |-- reports/feeds/hotspots.rss
  |-- reports/feeds/hotspots.json
```

## Scheduler Boundary

The scheduler is intentionally a one-shot planner/executor:

- `schedule:plan`: reads state and prints due/disabled/not-due tasks.
- `schedule:run`: runs due tasks once, then updates `data/scheduler/state.json`.
- `schedule:run -- --max-tasks=1`: executes at most one due task.
- `schedule:run -- --task=collect:hotspots`: executes only the selected due task.

It does not stay resident, manage workers, or retry forever. External tools can call it repeatedly.

## Credential And Browser Boundary

Credentialed collection is opt-in:

- `secrets:set` writes local credentials under ignored `data/secrets/` and only prints redacted status.
- `browser:login` opens a user-controlled Chrome/Edge profile under ignored `data/sessions/<platform>/`.
- Collectors do not auto-open login windows.
- Missing RSSHub, cookie, or browser-session setup must return source health instead of fake success.

## Reuse Strategy

| Project | Reuse Point | Current Treatment |
| --- | --- | --- |
| dsaj4/BiliSum | Bilibili video understanding and note generation | External fork, custom branch `hotspot/ai-subtitle` |
| yllhwa/RSSWorker | Multi-platform RSS route patterns | Reference only |
| DIYgod/RSSHub | Broad route catalog and RSS conventions | Fallback/reference, not primary dependency |
| dsaj4/wewe-rss | WeChat official-account RSS generation and export | External fork, custom branch `hotspot/wechat-official-account-adapter` |
| TrendRadar / next-daily-hot | Domestic hotspot source selection | Used for adapter source decisions |
| trend-pulse | Technical/international trend sources | Used for GitHub/HN/Google-style additions |

## Verification

- `npm.cmd run check` must pass.
- `npm.cmd run validate:fixtures` must pass for public fixtures.
- Public hotspot collection should not depend on X credentials.
- Credentialed sources should return `unavailable` health when credentials are absent.
- Every real fetch should preserve a raw snapshot.
- Normalized items must include `rawRef` and `dedupeKey`.

## Next Steps

1. Reorganize source and tests by functional domain after the deprecated path is removed.
2. Run a real BiliSum smoke test against `BV1tfoNBqEtN` after confirming port `3838` is served by the external BiliSum fork.
3. Push the final migration branch after `npm.cmd run check` passes.
