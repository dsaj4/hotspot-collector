# Hotspot Collector Handoff And Project Status

Updated: 2026-06-09

## 1. Project Location

- Main project: `E:\Project\hotspot-collector`
- Related workspace: `E:\Project\vision-lib`
- WeChat RSS wrapper: `E:\Project\hotspot-collector\company-wechat-rss`

This project is a local-first hotspot and subscription collection system. The current priority is the main collector plus the paired material hub: real data access, source health, raw snapshots, normalized JSONL, scheduling, single-source digests, readable material cards, and repository readiness.

## 2. Current Status Summary

The project has reached a usable MVP-plus state:

- TypeScript/Node project is initialized with npm scripts.
- Main collection adapters exist for Bilibili, WeChat RSS, and multiple hotspot sources. X API v2 and Xiaohongshu paths have been removed from the current phase.
- Infohub-style source catalog, URL detection, RSSHub route compatibility, direct RSS/YouTube subscriptions, local secret storage, browser-session profile commands, and RSS/JSON Feed output have been added.
- Material hub now has source digests, four writing profiles, source-budget checks, and real DeepSeek card generation.
- File storage writes raw snapshots, normalized JSONL, source health, and scheduler state.
- One-shot scheduler exists for due-task planning and execution.
- Test framework, fixture validation, CI, license, contribution docs, security docs, changelog, GitHub templates, and public fixtures are in place.
- Git repository has been initialized locally, but no commit has been created yet.

Latest known validation:

```text
npm.cmd run check
```

Last observed result: typecheck passed, 25 test files passed, 71 tests passed, 5 public fixture files validated successfully.

## 3. Implemented Commands

Collection:

```text
npm.cmd run collect:subscriptions
npm.cmd run discover:bilibili-followings
npm.cmd run collect:subscriptions:followings
npm.cmd run collect:wechat
npm.cmd run collect:hotspots
npm.cmd run collect:all
```

Scheduling:

```text
npm.cmd run schedule:plan
npm.cmd run schedule:run
npm.cmd run schedule:run -- --max-tasks=1
npm.cmd run schedule:run -- --task=collect:hotspots
npm.cmd run source:detect -- https://space.bilibili.com/289842886
npm.cmd run source:template -- https://x.com/example
npm.cmd run secrets:status
npm.cmd run browser:status -- --platform=x
npm.cmd run feed:generate
npm.cmd run feed:generate -- --kind=subscriptions
```

Validation:

```text
npm.cmd run typecheck
npm.cmd run test
npm.cmd run validate:fixtures
npm.cmd run check
```

Reserved/design-stage:

```text
npm.cmd run materials:generate
npm.cmd run sync:content-system
npm.cmd run report:daily
```

## 4. Data Sources And Access Methods

### Bilibili

Implemented:

- Configured UID dynamics/videos.
- Optional explicit `BILIBILI_COOKIE`.
- Following discovery through `https://api.bilibili.com/x/relation/followings`.
- Followed-UP batch collection.

Known verification:

- Browser session contained `SESSDATA`, `bili_jct`, and `DedeUserID`.
- Following API returned HTTP 200, API code `0`, total `165`, first page `20`.
- Command-line collection still requires explicit `BILIBILI_COOKIE`; browser cookies are not automatically copied into project config.

Current caveat:

- Anonymous or non-cookie Bilibili video/dynamic endpoints may return empty/error health for some UIDs.
- This is expected behavior; do not fake successful items.

### WeChat RSS

Implemented:

- `company-wechat-rss/` wrapper generated from the local `company-wechat-rss-fetch` skill.
- Upstream `wewe-rss` cloned under `company-wechat-rss/vendor/wewe-rss`.
- Runtime prepared and local server was started successfully at `http://127.0.0.1:4000/dash`.
- Main collector consumes `/feeds/<feed>.json` and falls back to `/feeds/<feed>.rss`.

Current caveat:

- Real WeChat output requires dashboard login and adding public-account feeds.
- Existing `collect:wechat` command works but returns empty until feeds are configured.

### X Platform

Current state:

- Official X API v2 collection has been removed because API credentials are not available.
- X support can now be represented through disabled source templates and RSSHub/browser-session source catalog entries.
- No X path is enabled by default in the current phase.

### Xiaohongshu

Current state:

- Removed from this phase.
- Revisit only after a separate access and risk review.

### Hotspot Sources

Implemented:

- Bilibili popular
- Weibo hot search via NewsNow
- Zhihu hot list
- Douyin hot search
- Baidu hot search
- GitHub Trending
- Hacker News front page
- Google News AI RSS

Known result:

- Public hotspot collection has successfully returned around 327-328 items in previous runs.

## 5. Storage Layout

Generated local data:

```text
data/raw/<date>/*.json
data/normalized/<date>/subscriptions.jsonl
data/normalized/<date>/hotspots.jsonl
data/health/source-health.json
data/scheduler/state.json
data/secrets/
data/sessions/
reports/feeds/
```

Public fixtures:

```text
fixtures/raw/*.json
fixtures/normalized/subscriptions/*.jsonl
fixtures/normalized/hotspots/*.jsonl
fixtures/health/*.json
```

Ignored local runtime/output:

```text
node_modules/
data/
reports/
company-wechat-rss/vendor/
company-wechat-rss/tmp/
company-wechat-rss/output/
.env
.env.local
```

## 6. Repository Readiness

Already added:

- `.env.example`
- `.editorconfig`
- `.gitattributes`
- `.gitignore`
- `.github/workflows/ci.yml`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/source_request.md`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `LICENSE`
- `SECURITY.md`
- public fixtures and validators

Git state:

- `git init` has been run.
- No initial commit has been made.
- Because of local ownership, use this form for status checks in the current environment:

```text
git -c safe.directory=E:/Project/hotspot-collector status --short
git -c safe.directory=E:/Project/hotspot-collector ls-files --others --exclude-standard
```

Important:

- Do not commit `data/`, `node_modules/`, WeWe RSS runtime output, local `.env` files, cookies, or tokens.

## 7. Key Files

Core:

- `src/cli.ts`
- `src/config.ts`
- `src/types.ts`
- `src/core/storage.ts`
- `src/core/http.ts`
- `src/core/env.ts`

Collectors:

- `src/collectors/hotspots.ts`
- `src/collectors/subscriptions.ts`

Adapters:

- `src/adapters/subscriptions/bilibili.ts`
- `src/adapters/subscriptions/wechat-rss.ts`
- `src/adapters/subscriptions/rss.ts`
- `src/adapters/subscriptions/rsshub.ts`
- `src/adapters/hotspots/*.ts`

Scheduler:

- `src/scheduler/tasks.ts`
- `src/scheduler/run.ts`

Validators:

- `src/validators/normalized.ts`
- `src/validators/fixtures.ts`

Tests:

- `tests/env.test.ts`
- `tests/hotspot-common.test.ts`
- `tests/http.test.ts`
- `tests/scheduler.test.ts`
- `tests/validators.test.ts`
- `tests/wechat-rss.test.ts`

Docs:

- `docs/design-and-reuse.md`
- `docs/source-entry-decisions.md`
- `docs/analysis-and-material-system.md`
- `docs/github-readiness.md`
- `docs/handoff-project-status.md`

## 8. Known Risks And Boundaries

- Do not bypass anti-bot systems.
- Do not log full cookies or tokens.
- Credentialed sources must return `unavailable` health when credentials are missing.
- Third-party aggregators must be marked in `provider`.
- Raw snapshots and normalized items must preserve traceability through `rawRef`.
- Content-system sync should remain conservative until IMA alignment and review surfaces are complete.

## 9. Recommended Next Steps

1. Run `npm.cmd run check` before any further changes.
2. Make the first local commit after reviewing `git ls-files --others --exclude-standard`.
3. Add mocked integration tests for each source adapter.
4. Add a safe Bilibili cookie import helper that writes to `data/secrets/` and never prints full cookies.
5. Complete real WeChat feed setup in `http://127.0.0.1:4000/dash`, then verify `npm.cmd run collect:wechat`.
6. Add Infohub-compatible RSSHub/browser-session source paths for X only after local verification.
7. Decide whether the repository stays private/internal or should be published as open source.
8. After credentials and feed setup are verified, document real credentialed verification results in `docs/source-entry-decisions.md`.

## 10. Quick Resume Checklist

Use this when resuming work:

```text
cd E:\Project\hotspot-collector
npm.cmd run check
npm.cmd run schedule:plan
git -c safe.directory=E:/Project/hotspot-collector status --short
```

If continuing collection work, prefer a single targeted command first:

```text
npm.cmd run schedule:run -- --max-tasks=1
```

If working on credentials, use explicit environment variables and never paste full tokens or cookies into committed files.
