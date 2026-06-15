# Infohub Source Compatibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand `hotspot-collector` toward Infohub-compatible data source coverage while keeping the current file-first, CLI-first, no-database, no-UI boundary.

**Architecture:** Add a source catalog, source detection, credential/session runtime, browser-backed collectors, RSSHub compatibility, and feed output as separate layers around the existing adapter/collector/storage pipeline. All new source paths must still write raw snapshots, normalized JSONL, and source health; credentialed paths are explicit opt-in and never enabled by default. The current X / Twitter official API route is removed because API access is not available; X coverage should be replaced only by Infohub-derived RSSHub or browser-session paths that can be verified locally.

**Tech Stack:** TypeScript, Node.js 22+, `tsx`, Vitest, existing file storage, optional `puppeteer-core` or Playwright-compatible browser automation, optional local RSSHub runtime, no SQLite/Postgres, no frontend.

---

## Assumptions

- The user has explicitly approved planning for Cookie, browser login, and Puppeteer-style capabilities for this project.
- That approval does not mean bypassing login walls, anti-bot controls, paywalls, or platform access restrictions.
- Cookie/browser-backed sources may be implemented, but only behind explicit config and commands.
- The internal source of truth remains normalized JSON/JSONL; RSS/XML is compatibility output.
- SQLite, Postgres, Hono, Next.js, and a browser UI stay out of scope for this phase.
- X / Twitter official API support is removed from the target architecture because API credentials are not obtainable.
- Xiaohongshu is removed from this phase entirely and should be revisited in a later plan.

## Success Criteria

```text
1. Source catalog - verify: Infohub-style platforms can be declared without touching collector code.
2. Credential runtime - verify: cookie/token/session paths are opt-in and never print secrets.
3. RSSHub compatibility - verify: supported RSSHub routes can be resolved, fetched, snapshotted, and normalized.
4. Browser collectors - verify: at least one approved browser-backed source writes raw + normalized + health.
5. Feed output - verify: normalized JSONL can generate RSS/JSON Feed compatibility files.
6. Validation - verify: npm.cmd run check passes and credential-free environments return unavailable health instead of failures.
```

## Target Source Coverage

Infohub-compatible source families:

- Bilibili: configured UID videos/dynamics, following discovery, public fallback, optional login cookie.
- X / Twitter: remove the current official API path; if Infohub's `xBrowserCollector` or RSSHub route works, use that implementation style as the replacement path.
- Weibo: public hot lists stay; add user/profile subscription via RSSHub or browser-backed session path.
- Zhihu: hot list stays; add people activity subscription via RSSHub first, browser/session only if explicitly configured.
- WeChat: keep local WeWe RSS path; add safer source detection for existing local feeds and article URLs when resolver credentials are configured.
- YouTube: add native channel RSS subscriptions and optional public page fallback.
- Generic RSS/Atom: direct parse as subscription source.
- Public RSS pool: file-based catalog of curated feeds inspired by Infohub `public_sources`.

## Architecture Boundary

The new shape should be:

```text
config/source-catalog.json
config/public-sources.json
data/secrets/                  # local only, ignored
data/sessions/                 # local only, ignored

source detector
  -> source config
  -> adapter selection
  -> fetch mode:
       public-api | direct-rss | rsshub | cookie-http | browser-session
  -> raw snapshot
  -> normalized JSONL
  -> source health
  -> optional RSS/JSON Feed output
```

No database is introduced. State remains in files:

- `data/raw/<date>/*.json`
- `data/normalized/<date>/*.jsonl`
- `data/health/source-health.json`
- `data/scheduler/state.json`
- `data/secrets/*` for local credentials, ignored by git
- `data/sessions/*` for browser session state, ignored by git

## Key Decisions

### Decision 1: Use a File-Based Source Catalog

Adopt Infohub's `sources` idea without adopting its database schema. The catalog should be JSON or TypeScript data, with one source definition per platform/account/feed.

Tradeoff:

- Pros: simple, reviewable, works with CLI, no migration burden.
- Cons: no multi-user editing, no built-in read/favorite state.

### Decision 2: Treat Credentialed Collection as a Separate Fetch Mode

Do not mix public and credentialed access inside the same hidden code path. Each source declares its mode and policy.

Example policy:

```json
{
  "requiresLogin": true,
  "usesCookie": true,
  "usesBrowserSession": false,
  "publicOnly": false,
  "enabledByDefault": false
}
```

Tradeoff:

- Pros: safer audits, clearer health messages, easier tests.
- Cons: more explicit source config.

### Decision 3: Add RSSHub as Compatibility, Not Core Truth

Infohub relies heavily on RSSHub route generation. This project should support RSSHub routes as one adapter family while preserving `provider: "rsshub"` and raw snapshots.

Tradeoff:

- Pros: broad source coverage quickly.
- Cons: route stability depends on RSSHub and upstream sites.

### Decision 4: Add Browser Runtime as Opt-In Infrastructure

Introduce a browser/session layer for platforms where official/public/RSS paths are insufficient. This layer should handle session storage and page reads, but platform adapters remain responsible for normalization.

Tradeoff:

- Pros: more sources, closer Infohub compatibility.
- Cons: higher operational fragility, more local setup, more platform-policy risk.

## Proposed Files

Create:

- `src/sources/catalog.ts`
- `src/sources/detect.ts`
- `src/sources/rsshub.ts`
- `src/core/secrets.ts`
- `src/core/browser-session.ts`
- `src/feeds/rss.ts`
- `src/feeds/json-feed.ts`
- `src/feeds/generate.ts`
- `config/sources.example.json`
- `config/public-sources.json`
- `tests/sources-detect.test.ts`
- `tests/rsshub-routes.test.ts`
- `tests/feeds.test.ts`

Modify:

- `src/types.ts`
- `src/config.ts`
- `src/cli.ts`
- `src/collectors/subscriptions.ts`
- `src/adapters/subscriptions/x.ts`
- `src/adapters/hotspots/x.ts`
- `src/scheduler/tasks.ts`
- `src/validators/normalized.ts`
- `.env.example`
- `.gitignore`
- `README.md`
- `docs/design-and-reuse.md`
- `docs/source-entry-decisions.md`

## Task 1: Extend Core Types

**Files:**

- Modify: `src/types.ts`
- Test: `tests/validators.test.ts`

Add explicit source modes:

```ts
export type SourceFetchMode =
  | "public-api"
  | "direct-rss"
  | "rsshub"
  | "cookie-http"
  | "browser-session";
```

Extend `SourceConfig.policy` with:

```ts
usesBrowserSession: boolean;
enabledByDefault: boolean;
```

Extend `SourceHealth` with:

```ts
lastSuccessAt?: string;
lastErrorAt?: string;
nextAction?: string;
```

Verify:

```text
npm.cmd run typecheck
npm.cmd run test -- tests/validators.test.ts
```

## Task 1A: Remove Current X Official API Surface

**Files:**

- Modify: `src/config.ts`
- Modify: `src/cli.ts`
- Modify: `src/collectors/subscriptions.ts`
- Modify: `src/collectors/hotspots.ts`
- Modify: `src/adapters/subscriptions/x.ts`
- Modify: `src/adapters/hotspots/x.ts`
- Modify: `src/scheduler/tasks.ts`
- Modify: `.env.example`
- Modify: `README.md`
- Test: `tests/scheduler.test.ts`

Remove the current assumption that X data comes from official API v2. During implementation, either delete the API-specific adapters or replace their exports with explicit `unavailable` compatibility shims until the Infohub-derived RSSHub/browser-session adapter lands.

Remove or deprecate:

- `X_BEARER_TOKEN`
- `X_USERNAMES`
- `X_FOLLOWER_LIMIT`
- `X_TWEET_LIMIT`
- `X_HOTSPOT_QUERIES`
- `collect:x:accounts`
- `discover:x:followers`
- `collect:x:followers`
- official API `x-recent-search`

Replacement rule:

- X can only return in this phase through `rsshub` or `browser-session`.
- If Infohub has a verified implementation for the path, adapt that implementation style directly over the current X API path.
- If neither path is configured, source health should be `unavailable` with a `nextAction` that names RSSHub/browser-session setup.

Verify:

```text
npm.cmd run typecheck
npm.cmd run test -- tests/scheduler.test.ts
npm.cmd run schedule:plan
```

## Task 2: Add File-Based Source Catalog

**Files:**

- Create: `src/sources/catalog.ts`
- Create: `config/sources.example.json`
- Create: `config/public-sources.json`
- Modify: `src/config.ts`
- Test: `tests/source-catalog.test.ts`

The catalog should load configured sources from a JSON file if present, otherwise fall back to current env-based defaults. This keeps existing commands working.

Initial catalog categories:

- `subscription:bilibili`
- `subscription:x`
- `subscription:wechat-rss`
- `subscription:rss`
- `subscription:youtube`
- `subscription:weibo`
- `subscription:zhihu`
- `hotspot:*`

Remove or disable the current X official API catalog entries and environment-driven X defaults. X entries in this phase must point to `rsshub` or `browser-session`, not `official-api`.

Verify:

```text
npm.cmd run test -- tests/source-catalog.test.ts
npm.cmd run collect:hotspots
```

## Task 3: Add Source Detection

**Files:**

- Create: `src/sources/detect.ts`
- Modify: `src/cli.ts`
- Test: `tests/sources-detect.test.ts`

Add CLI commands:

```text
npm.cmd run source:detect -- <url>
npm.cmd run source:template -- <url>
```

Supported detection:

- `space.bilibili.com/<uid>` -> Bilibili source template
- `x.com/<username>` -> X source template only when the selected mode is `rsshub` or `browser-session`
- `weibo.com/u/<uid>` or `weibo.com/<id>` -> Weibo source template
- `zhihu.com/people/<id>` -> Zhihu source template
- `youtube.com/@handle` and `/channel/<id>` -> YouTube source template
- `mp.weixin.qq.com` -> WeChat advisory result, not automatic enabled source unless local resolver is configured
- RSS/Atom URLs -> generic RSS source template

Verify:

```text
npm.cmd run test -- tests/sources-detect.test.ts
```

## Task 4: Add RSSHub Compatibility Layer

**Files:**

- Create: `src/sources/rsshub.ts`
- Create: `src/adapters/subscriptions/rsshub.ts`
- Modify: `src/collectors/subscriptions.ts`
- Test: `tests/rsshub-routes.test.ts`

Implement route builders inspired by Infohub:

- Zhihu people activities
- X/Twitter user
- Bilibili user video
- Weibo user

Rules:

- `provider` must be `rsshub`.
- Raw RSS/XML/JSON response must be snapshotted.
- Missing `RSSHUB_BASE_URL` returns `unavailable`, not error.
- RSSHub route failures must produce actionable `SourceHealth.nextAction`.

Verify:

```text
npm.cmd run test -- tests/rsshub-routes.test.ts
npm.cmd run validate:fixtures
```

## Task 5: Add Local Secret Store

**Files:**

- Create: `src/core/secrets.ts`
- Modify: `.gitignore`
- Modify: `.env.example`
- Test: `tests/secrets.test.ts`

Store local credentials under `data/secrets/`, never committed. This should support:

- Bilibili cookie
- Weibo cookie
- Zhihu cookie
- X browser auth note or RSSHub-related token/cookie only if required by the chosen Infohub-derived route

Do not support `X_BEARER_TOKEN` in this phase. Remove it from config, docs, default tasks, and source health expectations during implementation.

Commands:

```text
npm.cmd run secrets:set -- --platform=bilibili --type=cookie
npm.cmd run secrets:status
npm.cmd run secrets:delete -- --platform=bilibili
```

Implementation rule:

- Never print full secrets.
- Show only platform, type, configured boolean, updated time, and last four characters of a hash.

Verify:

```text
npm.cmd run test -- tests/secrets.test.ts
git -c safe.directory=E:/Project/hotspot-collector status --short
```

## Task 6: Add Browser Session Runtime

**Files:**

- Create: `src/core/browser-session.ts`
- Modify: `package.json`
- Modify: `.env.example`
- Test: `tests/browser-session.test.ts`

Add an opt-in browser runtime using `puppeteer-core` or a locally installed Chrome path.

Commands:

```text
npm.cmd run browser:login -- --platform=weibo
npm.cmd run browser:status
npm.cmd run browser:clear -- --platform=weibo
```

Rules:

- Browser login opens an interactive browser only when the user runs the command.
- Session files live under `data/sessions/<platform>/`.
- Collectors do not auto-open login windows.
- If session is missing or expired, source health returns `unavailable`.

Verify:

```text
npm.cmd run typecheck
npm.cmd run test -- tests/browser-session.test.ts
```

## Task 7: Add Browser-Backed Subscription Adapters

**Files:**

- Create: `src/adapters/subscriptions/weibo-browser.ts`
- Create: `src/adapters/subscriptions/x-browser.ts`
- Modify: `src/collectors/subscriptions.ts`
- Test: `tests/browser-adapters.test.ts`

Start with one platform first, recommended order:

1. Weibo profile timeline
2. X profile timeline using Infohub's browser-session approach if it can be verified locally

Rules:

- Use browser session only for pages the logged-in user can normally view.
- Do not solve captchas, bypass rate limits, or automate prohibited flows.
- Normalize to `SubscriptionItem`.
- Preserve HTML/API payload as raw snapshot.

Verify:

```text
npm.cmd run test -- tests/browser-adapters.test.ts
npm.cmd run collect:subscriptions
```

## Task 8: Add Generic RSS and YouTube Subscriptions

**Files:**

- Create: `src/adapters/subscriptions/rss.ts`
- Create: `src/adapters/subscriptions/youtube.ts`
- Modify: `src/collectors/subscriptions.ts`
- Test: `tests/rss-subscriptions.test.ts`

Generic RSS should parse RSS/Atom feeds and normalize items. YouTube should prefer native channel RSS:

```text
https://www.youtube.com/feeds/videos.xml?channel_id=<channelId>
```

Verify:

```text
npm.cmd run test -- tests/rss-subscriptions.test.ts
```

## Task 9: Add Feed Output

**Files:**

- Create: `src/feeds/rss.ts`
- Create: `src/feeds/json-feed.ts`
- Create: `src/feeds/generate.ts`
- Modify: `src/cli.ts`
- Test: `tests/feeds.test.ts`

Commands:

```text
npm.cmd run feed:generate
npm.cmd run feed:generate -- --kind=subscriptions
npm.cmd run feed:generate -- --kind=hotspots
```

Outputs:

```text
reports/feeds/subscriptions.rss
reports/feeds/subscriptions.json
reports/feeds/hotspots.rss
reports/feeds/hotspots.json
```

Verify:

```text
npm.cmd run test -- tests/feeds.test.ts
npm.cmd run feed:generate
```

## Task 10: Update Scheduler

**Files:**

- Modify: `src/scheduler/tasks.ts`
- Modify: `src/scheduler/run.ts`
- Test: `tests/scheduler.test.ts`

Add tasks for:

- generic RSS subscriptions
- YouTube subscriptions
- RSSHub subscriptions
- explicitly enabled browser-session subscriptions
- feed generation

Remove current X official API tasks and commands from the target implementation:

- `collect:x:accounts`
- `discover:x:followers`
- `collect:x:followers`
- `x-recent-search` as an official API hotspot source

If X is reintroduced in this phase, expose it through source-catalog-driven RSSHub/browser-session collection instead.

Rules:

- Credentialed/browser tasks stay disabled unless the source catalog enables them.
- Missing credentials produce skipped/unavailable health, not process failure.

Verify:

```text
npm.cmd run test -- tests/scheduler.test.ts
npm.cmd run schedule:plan
```

## Task 11: Fixture and Validator Expansion

**Files:**

- Modify: `src/validators/normalized.ts`
- Create: `fixtures/raw/rss-sample.xml`
- Create: `fixtures/raw/rsshub-zhihu-sample.xml`
- Create: `fixtures/normalized/subscriptions/rss-sample.jsonl`
- Test: `tests/validators.test.ts`

Add sample fixtures for:

- direct RSS item
- RSSHub item
- browser-backed item shape, using sanitized public mock data

Verify:

```text
npm.cmd run validate:fixtures
npm.cmd run check
```

## Task 12: Documentation Update

**Files:**

- Modify: `README.md`
- Modify: `docs/design-and-reuse.md`
- Modify: `docs/source-entry-decisions.md`
- Create: `docs/credentialed-sources.md`

Document:

- which Infohub source families are compatible
- which mode each platform uses
- how to configure credentials
- what is deliberately not automated
- how to clear local secrets and browser sessions

Verify:

```text
npm.cmd run check
```

## Risk Register

| Risk | Mitigation |
| --- | --- |
| Cookie leakage | Never log secrets; store under ignored `data/secrets`; redact status output. |
| Anti-bot or access-policy violations | Do not solve captchas, bypass paywalls, or force blocked access; return `unavailable`. |
| Browser collectors become brittle | Start with one platform; add fixtures and selector diagnostics; keep RSS/public paths preferred. |
| RSSHub instability | Mark `provider: rsshub`; preserve raw snapshots; health messages name the route and base URL. |
| X official API removal breaks existing commands | Remove or deprecate X API commands in one controlled task; replace docs with RSSHub/browser-session guidance. |
| Scope creep into product UI | No Next.js, Hono, database, read/favorite state, or settings UI in this phase. |
| Schema churn | Extend existing types conservatively; validate fixtures before implementation branches merge. |

## Recommended Implementation Order

```text
1. Types and catalog - verify: typecheck and source catalog tests.
2. Detection and RSSHub - verify: route/detection tests and one RSSHub fixture.
3. Generic RSS and YouTube - verify: subscriptions JSONL from fixture feeds.
4. Secret store - verify: redacted status and ignored files.
5. Browser runtime - verify: session status commands without collectors.
6. One browser-backed adapter - verify: raw + normalized + health for a manually approved source.
7. Feed generation - verify: RSS/JSON Feed output from normalized JSONL.
8. Scheduler/docs - verify: npm.cmd run check.
```

## Definition of Done

- `npm.cmd run check` passes.
- Credential-free local runs do not fail because optional sources are unavailable.
- At least one Infohub-style RSSHub subscription source works end-to-end.
- At least one generic RSS source works end-to-end.
- At least one browser-session source is implemented behind explicit enablement.
- Generated feed files are derived from normalized JSONL, not direct source refetching.
- Documentation clearly separates public, credentialed, RSSHub, and browser-session modes.
- X official API configuration and tasks are removed or clearly deprecated.
- Xiaohongshu is absent from this phase's source catalog, tasks, credentials, and docs except as a future consideration.
