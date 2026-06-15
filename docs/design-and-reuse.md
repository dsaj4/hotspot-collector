# Design And Reuse

Updated: 2026-05-28

This project follows the installed Karpathy-style engineering guidelines: state assumptions, keep the first implementation verifiable, preserve raw evidence, and represent unstable sources as source health instead of fake success.

## Objective

Build a sustainable collection system for:

- Platform subscriptions: configured accounts, followed accounts, public-account feeds, and future RSSHub/browser-session sources.
- Platform hotspots: hot lists, search trends, and technical/community trends.

Automatic value judgment, summaries, and material cards remain design-stage work. The main collector should stay independent from those future analysis layers.

## Current Scope

### Subscriptions

- Bilibili: rewritten minimal adapter inspired by RSSWorker-Bilibili/RSSWorker. Supports UID dynamics, UID videos, following discovery, and followed-UP batch collection.
- WeChat: consumes a local WeWe RSS service. The main collector reads `/feeds/<feed>.json` and falls back to `/feeds/<feed>.rss`.
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
source adapters
  |-- subscriptions
  |     |-- bilibili
  |     |-- rss
  |     |-- rsshub
  |     |-- wechat-rss
  |
  |-- hotspots
        |-- bilibili
        |-- weibo
        |-- zhihu
        |-- douyin
        |-- baidu
        |-- github
        |-- hacker-news
        |-- google-news

collectors
  |-- collect subscriptions
  |-- collect hotspots
  |-- discover followings/followers

scheduler
  |-- plan due tasks
  |-- run due tasks once
  |-- persist task state

storage
  |-- data/raw/<date>/*.json
  |-- data/normalized/<date>/*.jsonl
  |-- data/health/source-health.json
  |-- data/scheduler/state.json
  |-- data/secrets/*.json (local ignored)
  |-- data/sessions/<platform>/ (local ignored)

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
| Nikkiiw/RSSWorker-Bilibili | Bilibili RSS and gRPC approach | Reference and rewrite minimal adapter |
| yllhwa/RSSWorker | Multi-platform RSS route patterns | Reference only |
| DIYgod/RSSHub | Broad route catalog and RSS conventions | Fallback/reference, not primary dependency |
| cooderl/wewe-rss | WeChat public-account RSS generation | Vendored under `company-wechat-rss/vendor/wewe-rss` |
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

1. Add mocked HTTP integration tests for every adapter.
2. Expand non-private raw snapshot fixtures as adapters mature.
3. Add a safe local Bilibili cookie import utility that never logs full cookies.
4. Verify real WeChat article output after feeds are added in WeWe RSS.
5. Add Infohub-compatible RSSHub/browser-session source paths for X only after local verification.
6. Initialize git when ready and prepare the first tagged release.
