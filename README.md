# Hotspot Collector

Local-first collection and material workflow orchestration for hotspots, subscriptions, social links, Bilibili video notes, and reviewable material cards.

The source repository intentionally stays small: TypeScript code, tests, fixtures, config templates, docs, scripts, and project-specific skills live here. Runtime outputs and upstream-derived applications are mounted from local external roots.

## Current Shape

```text
hotspot-collector/                         source repository
E:/Project/hotspot-collector-data/         local runtime data root
E:/Project/hotspot-collector-external/     external upstream-derived apps
```

External applications are not submodules:

- `E:/Project/hotspot-collector-external/BiliSum`
- `E:/Project/hotspot-collector-external/wewe-rss`

Runtime artifacts keep stable logical references such as `data/raw/...` and `reports/feeds/...`, but default writes are redirected to `E:/Project/hotspot-collector-data` on this workstation.

## Repository Boundary

This repository is the orchestration layer. It owns:

- TypeScript collection, normalization, workflow, scheduler, and material-pipeline code.
- Tests, fixtures, config templates, docs, scripts, and project-specific skills.
- Integration points to external applications.

It does not own:

- Runtime data, generated reports, generated notes, screenshots, video/audio downloads, cookies, browser profiles, or logs.
- Forked upstream applications. BiliSum and WeWe RSS are maintained in separate local Git repositories under `HOTSPOT_EXTERNAL_ROOT`.

Legacy Bilibili following/subtitle collector code has been removed from this repository. The maintained path is Bilibili URL acquisition through `social-browser-collection`, then video understanding through external BiliSum.

## Install

```text
npm ci
```

Node.js 22 or newer is required.

## Environment

Copy `.env.example` to `.env.local` or set variables in the shell.

Core roots:

- `HOTSPOT_DATA_ROOT`: runtime data root. Recommended: `E:/Project/hotspot-collector-data`.
- `HOTSPOT_EXTERNAL_ROOT`: external app root. Recommended: `E:/Project/hotspot-collector-external`.
- `BILISUM_PROJECT_ROOT`: external BiliSum checkout.
- `BILISUM_APP_DATA_ROOT`: BiliSum app/runtime data root.
- `WEWE_RSS_PROJECT_ROOT`: external WeWe RSS checkout.

Collection and integration variables:

- `BILIBILI_COOKIE`: optional explicit cookie for BiliSum setup handoff when local access is allowed.
- `WECHAT_RSS_BASE_URL`: local WeWe RSS URL, default `http://127.0.0.1:4000`.
- `WECHAT_RSS_FEEDS`: comma-separated WeWe RSS feed ids, default `all`.
- `WECHAT_RSS_LIMIT`: max articles per WeChat feed, default `30`.
- `RSSHUB_BASE_URL`: optional local RSSHub base URL for RSSHub-compatible sources.
- `GENERIC_RSS_LIMIT`: max items per generic RSS/RSSHub source, default `30`.
- `BROWSER_EXECUTABLE_PATH`: optional Chrome or Edge executable path for explicit browser-session login.

Credentialed paths are opt-in. Do not commit `.env.local`, cookies, browser profiles, database files, screenshots, generated notes, or runtime logs.

## Main Commands

Preferred workflows:

```text
npm.cmd run workflow:hotspots -- --stage=collect
npm.cmd run workflow:hotspots -- --stage=digest --mode=local-rule
npm.cmd run workflow:hotspots -- --stage=material --mode=deepseek
npm.cmd run workflow:subscriptions -- --stage=collect
npm.cmd run workflow:subscriptions -- --stage=digest --mode=local-rule
npm.cmd run workflow:subscriptions -- --stage=material --mode=deepseek
npm.cmd run material:from-link -- --url=https://example.com/article --content-file=E:\path\to\article.md --mode=deepseek
```

BiliSum video notes:

```text
npm.cmd run video:bilisum-status
npm.cmd run video:setup-bilisum
npm.cmd run video:notes-bilibili -- --url=https://www.bilibili.com/video/BV1tfoNBqEtN
npm.cmd run video:notes-bilibili-list -- --input=E:\path\to\bilibili-url-list.json --limit=10
```

Collection, scheduling, and compatibility commands:

```text
npm.cmd run collect:subscriptions
npm.cmd run collect:official-accounts
npm.cmd run collect:wechat
npm.cmd run collect:hotspots
npm.cmd run collect:all
npm.cmd run schedule:plan
npm.cmd run schedule:run
npm.cmd run feed:generate
npm.cmd run report:daily
```

`collect:wechat` is a compatibility alias for `collect:official-accounts`. Prefer the official-account naming in new docs and automation.

Legacy Bilibili commands `discover:bilibili-followings`, `collect:subscriptions:followings`, and `collect:bilibili-subtitles` have been removed. Use `social-browser-collection` for URL selection and BiliSum for video understanding.

Development checks:

```text
npm.cmd run typecheck
npm.cmd test
npm.cmd run validate:fixtures
npm.cmd run check
```

## Data Root

Default runtime writes on this workstation:

```text
data/raw/...          -> E:/Project/hotspot-collector-data/raw/...
data/normalized/...   -> E:/Project/hotspot-collector-data/normalized/...
data/health/...       -> E:/Project/hotspot-collector-data/health/...
data/secrets/...      -> E:/Project/hotspot-collector-data/secrets/...
data/sessions/...     -> E:/Project/hotspot-collector-data/sessions/...
reports/...           -> E:/Project/hotspot-collector-data/reports/...
```

See [docs/operations/data-root.md](docs/operations/data-root.md).

## External Apps

BiliSum fork:

```text
path:     E:/Project/hotspot-collector-external/BiliSum
origin:   https://github.com/dsaj4/BiliSum.git
upstream: https://github.com/lycohana/BiliSum.git
branch:   hotspot/ai-subtitle
```

Local verified branch head:

```text
5f5767c test: cover bilibili ai subtitle fallback
```

WeWe RSS fork:

```text
path:     E:/Project/hotspot-collector-external/wewe-rss
origin:   https://github.com/dsaj4/wewe-rss.git
upstream: https://github.com/cooderl/wewe-rss.git
branch:   hotspot/wechat-official-account-adapter
```

Local verified branch heads:

```text
0b5830f chore: ignore python cache files
472f872 feat: add hotspot official account export
```

See [docs/operations/external-dependencies.md](docs/operations/external-dependencies.md).

## Bilibili Video Notes

`video:notes-bilibili` calls the external BiliSum service and writes learning packages under the external data root. The BiliSum fork owns Bilibili platform subtitle acquisition, including AI subtitles when available, before falling back to ASR.

Full-fidelity video notes are a future requirement: preserve the video's argument structure, evidence order, and visual references instead of collapsing everything into a high-level abstract. See [docs/requirements/full-fidelity-video-notes.md](docs/requirements/full-fidelity-video-notes.md).

## Official Accounts

WeChat public account collection is routed through a local WeWe RSS service. The target external fork uses the generic "official account" model, not a company-only model. Configuration should use groups/accounts and export `official_account_articles.json` / `official_account_articles.csv`.

See [docs/integrations/wewe-rss.md](docs/integrations/wewe-rss.md).

## Social Browser Collection

Browser-visible social collection is handled by the project skill `social-browser-collection`. It collects visible URLs and metadata from pages such as Bilibili favorites/search/home feeds, Weibo streams, Xiaohongshu note lists, and WeWe RSS setup pages. The browser stage should stop at URL lists or normalized observations unless an explicit ingestion command is requested.

See [docs/integrations/social-browser-collection.md](docs/integrations/social-browser-collection.md).

## Material Hub Workflow

The main material path is:

```text
source collection -> SourceDigest -> digest brief -> aggregate material card -> optional explicit IMA sync
```

Collection does not automatically sync to IMA. IMA synchronization is explicit and reviewable.

## Repository Docs

- [Repository guide](docs/repository-guide.md)
- [Architecture overview](docs/architecture/overview.md)
- [Data root](docs/operations/data-root.md)
- [External dependencies](docs/operations/external-dependencies.md)
- [BiliSum integration](docs/integrations/bilisum.md)
- [WeWe RSS integration](docs/integrations/wewe-rss.md)
- [Social browser collection](docs/integrations/social-browser-collection.md)
- [Smoke tests](docs/operations/smoke-tests.md)
- [Full-fidelity video notes requirement](docs/requirements/full-fidelity-video-notes.md)
- [Migration plan](docs/migration/project-structure-migration-plan.md)
