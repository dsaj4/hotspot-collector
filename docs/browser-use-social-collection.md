# Browser-Use Social Collection

Browser-visible collection is the primary acquisition path for selected social pages. It collects visible URLs and item metadata, then hands off to ingestion, BiliSum, or the material pipeline.

## Commands

```text
npm.cmd run social:ingest -- --input=<browser-observation.json>
npm.cmd run social:fallback -- --source=<registered-source> --stream=<stream>
```

Browser observations write:

```text
data/raw/<date>/*.json                 -> HOTSPOT_DATA_ROOT/raw/<date>/*.json
data/normalized/<date>/social-items.jsonl
data/normalized/<date>/subscriptions.jsonl
data/normalized/<date>/hotspots.jsonl
data/health/source-health.json
```

Copy `config/browser-sources.example.json` to ignored `config/browser-sources.json` to customize streams, search keywords, target accounts, limits, and registered fallbacks.

## Downstream Handoffs

For Bilibili notes, pass selected URLs or a browser observation to BiliSum:

```text
npm.cmd run video:notes-bilibili-list -- --input=<browser-observation-or-url-list.json>
```

For material cards, route selected links through the material pipeline:

```text
npm.cmd run material:from-link -- --url=<url>
```

## Success Rules

- Automations attempt collection once per hour.
- A platform meets the operational SLA when it has at least one regular success in the rolling previous six hours.
- Valid empty results count as a successful observation and do not trigger fallback.
- Bilibili browser collection succeeds when selected video URLs are captured. Transcript and AI subtitle validation belongs to BiliSum.
- Every successful Xiaohongshu item should contain enough visible text or media references to support downstream review.

Browser tasks never log in, enter credentials, solve CAPTCHA, or bypass platform restrictions.
