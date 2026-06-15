# Browser-Use Social Collection

Codex Browser automations are the primary path for Bilibili, Weibo, and Xiaohongshu. The Node scheduler handles non-social public sources, WeWe RSS, and explicitly requested registered fallbacks.

## Commands

```text
npm.cmd run social:ingest -- --input=<browser-observation.json>
npm.cmd run social:fallback -- --source=<registered-source> --stream=<stream>
npm.cmd run collect:bilibili-subtitles -- --max-items=10
```

Browser observations write:

```text
data/raw/<date>/*.json
data/normalized/<date>/social-items.jsonl
data/normalized/<date>/subscriptions.jsonl
data/normalized/<date>/hotspots.jsonl
data/health/source-health.json
```

Copy `config/browser-sources.example.json` to ignored `config/browser-sources.json` to customize streams, search keywords, target accounts, limits, and registered fallbacks.

## Success Rules

- Automations attempt collection once per hour.
- A platform meets the operational SLA when it has at least one regular success in the rolling previous six hours.
- Valid empty results count as a successful observation and do not trigger fallback.
- Bilibili acceptance additionally requires `aiTranscriptCount >= 1`.
- Every successful Xiaohongshu item must contain non-empty body text and at least one image URL.

Browser tasks never log in, enter credentials, solve CAPTCHA, or bypass platform restrictions.
