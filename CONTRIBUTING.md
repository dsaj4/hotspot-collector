# Contributing

Thanks for improving Hotspot Collector. This project is a data collection system, so reliability and source transparency matter more than clever scraping.

## Local Checks

```text
npm ci
npm.cmd run typecheck
npm.cmd run test
```

On Windows PowerShell, use `npm.cmd` when script execution policy blocks `npm`.

## Source Rules

- Prefer official APIs, public RSS feeds, or documented local services.
- Mark third-party aggregate providers explicitly in `provider`.
- Do not add anti-bot bypasses.
- Do not log full cookies, tokens, or account secrets.
- If a credential is missing, return `unavailable` source health instead of pretending success.
- Every normalized item should keep `rawRef` and `dedupeKey`.

## Adding A Source

1. Add a small adapter under `src/adapters/subscriptions` or `src/adapters/hotspots`.
2. Add source health for success, empty responses, unavailable credentials, and errors.
3. Preserve raw snapshots before normalization.
4. Add tests for parsing and normalization helpers when possible.
5. Add or update public fixtures when output shape changes.
6. Run `npm run check`.
7. Update `docs/source-entry-decisions.md` and `.env.example`.
