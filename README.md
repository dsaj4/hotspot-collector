# Hotspot Collector

A local-first hotspot and subscription collection system. The main collection pipeline still lives here, but material processing is now active in the paired `material-hub-workspace`: real source access, source health, raw snapshots, normalized JSONL, repeated scheduled runs, single-source digests, and reviewable material cards.

## Capabilities

- Bilibili subscriptions: configured UID dynamics/videos, optional explicit `BILIBILI_COOKIE`, following discovery, and followed-UP batch collection.
- WeChat public accounts: consumes a local WeWe RSS service under `company-wechat-rss/`.
- X platform: official API v2 collection has been removed because API access is not available. Future support should use explicit RSSHub or browser-session paths.
- Hotspots: Bilibili, Weibo, Zhihu, Douyin, Baidu, GitHub Trending, Hacker News, and Google News AI.
- Xiaohongshu: removed from this phase; revisit only after a separate access and risk review.
- Scheduler: one-shot task planning and due-task execution for cron/Task Scheduler integration.

## Commands

```text
npm.cmd run video:notes-bilibili -- --url=https://www.bilibili.com/video/BV1mXEv6bEQo/
npm.cmd run video:notes-bilibili-list -- --input=E:\path\to\bilibili-url-list.json --limit=10
npm.cmd run workflow:hotspots -- --stage=collect
npm.cmd run workflow:hotspots -- --stage=digest --mode=local-rule
npm.cmd run workflow:hotspots -- --stage=material --mode=deepseek
npm.cmd run workflow:subscriptions -- --stage=collect
npm.cmd run workflow:subscriptions -- --stage=digest --mode=local-rule
npm.cmd run workflow:subscriptions -- --stage=material --mode=deepseek
npm.cmd run material:from-link -- --url=https://example.com/article --content-file=E:\path\to\article.md --mode=deepseek
npm.cmd run collect:subscriptions
npm.cmd run discover:bilibili-followings
npm.cmd run collect:subscriptions:followings
npm.cmd run collect:wechat
npm.cmd run collect:bilibili-subtitles
npm.cmd run collect:bilibili-subtitles -- --max-items=10
npm.cmd run collect:hotspots
npm.cmd run collect:all
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
npm.cmd run report:daily
npm.cmd run validate:fixtures
npm.cmd run check
```

`video:notes-bilibili`, `workflow:hotspots`, `workflow:subscriptions`, and `material:from-link` are the preferred high-level entry points. `materials:generate` and `sync:content-system` still exist, but they are secondary to the material-hub pipeline and are not the primary acceptance path.

## Environment

Copy `.env.example` to `.env.local` or set variables in your shell:

- `BILIBILI_COOKIE`: optional explicit login cookie for Bilibili followings and fallback APIs.
- `BILIBILI_FOLLOWING_LIMIT`: followed-UP batch limit, default `20`.
- `WECHAT_RSS_BASE_URL`: local WeWe RSS URL, default `http://127.0.0.1:4000`.
- `WECHAT_RSS_FEEDS`: comma-separated WeWe RSS feed ids, default `all`.
- `WECHAT_RSS_LIMIT`: max articles per WeChat feed, default `30`.
- `RSSHUB_BASE_URL`: optional local RSSHub base URL for Infohub-style routes.
- `GENERIC_RSS_LIMIT`: max items per generic RSS/RSSHub source, default `30`.
- `BROWSER_EXECUTABLE_PATH`: optional Chrome or Edge executable path for explicit browser-session login.

X / Twitter API environment variables are intentionally not supported in this phase.

## Bilibili Subtitles

`collect:bilibili-subtitles` reads the latest normalized subscriptions and hotspots, finds Bilibili video URLs, and uses `yt-dlp` to fetch existing platform subtitles only. It does not download audio and does not run ASR transcription. Videos without available subtitles are recorded as empty or unavailable health.

`collect:all` runs this subtitle step after subscription and hotspot collection, so Bilibili video subtitles become part of the main collection pipeline without changing the individual source adapters.

## BiliSum Video Notes

`video:notes-bilibili` runs the isolated BiliSum subsystem and writes a learning package under `data/video-notes/`. It is for video notes, transcript, knowledge note, visual note, multimodal enhanced note, mind map, and screenshot evidence. It does not publish a material source item unless the full material pipeline explicitly requests that behavior.

`video:notes-bilibili-list` processes a selected Bilibili URL list or `BrowserObservation` JSON and writes a batch learning-package index. It does not parse entire favorites pages, perform topic filtering, run LLM reranking, run ASR, or create material cards by default.

For a material card, use `material:from-link` instead. Bilibili links routed through `material:from-link` use BiliSum as an upstream video understanding step, then continue through SourceDigest and aggregate-card generation.

## Social Browser Collection

Browser-visible social-media collection is handled through the `social-browser-collection` skill. The browser stage extracts visible items and URL lists from pages such as Bilibili favorites, search results, home feeds, Weibo streams, Xiaohongshu note lists, and WeWe RSS setup pages. It stops at `BrowserObservation` or URL-list output and can call `social:ingest` when normalized collection is needed.

If collected Bilibili URLs should become video notes, pass the selected URL-list or observation JSON to `video:notes-bilibili-list`. If collected links should become material cards, route them through the material-hub pipeline.

## Material Hub Workflow

The current material workflow is:

```text
source collection -> SourceDigest -> digest brief -> aggregate material card -> optional explicit IMA sync
```

Digest writes compact source understanding and a readable brief. Aggregate cards focus on readable short-form material writing, source selection, discarded-source notes, conflicts, gaps, and traceability. IMA sync is explicit and is not triggered by collection or card generation.

## Source Catalog

Built-in sources are defined in code and can be previewed through `config/sources.example.json`. A local `config/sources.json` can be introduced for Infohub-style source entries as the next implementation step. Source templates generated by `source:template` are disabled by default, especially credentialed or browser-session sources.

## Credentials And Browser Sessions

Credentialed paths are opt-in. `secrets:set` stores local values under ignored `data/secrets/` and prints only redacted status. `browser:login` opens a local Chrome/Edge profile under ignored `data/sessions/<platform>/`; collectors do not auto-open login windows.

## Feed Output

`feed:generate` reads the latest normalized JSONL and writes RSS/JSON Feed compatibility files under `reports/feeds/`. It does not refetch source platforms.

## WeChat RSS

The workspace includes a WeWe RSS wrapper at `company-wechat-rss/`.

```text
cd E:\Project\hotspot-collector\company-wechat-rss
powershell -ExecutionPolicy Bypass -File .\scripts\prepare_wewe_rss_runtime.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start_wewe_rss.ps1
```

Open `http://127.0.0.1:4000/dash`, log in, and add public-account feeds. Then run `npm.cmd run collect:wechat`.

## Scheduler

`schedule:plan` prints the current task plan and which tasks are due. `schedule:run` executes due tasks once and writes `data/scheduler/state.json`. Use `--max-tasks=1` or `--task=<id>` during manual testing. It is intentionally not a long-running daemon, so it can be called by cron, Windows Task Scheduler, GitHub Actions, or another orchestrator.

## Development

```text
npm ci
npm.cmd run check
```

The check command runs TypeScript type checking, Vitest tests, and public fixture validation. CI uses the same gates.

Public fixtures live under `fixtures/` and include raw snapshots, normalized JSONL, and source-health examples. Run `npm.cmd run validate:fixtures` when changing output shapes.

## Docs

- [Design and reuse](docs/design-and-reuse.md)
- [Source entry decisions](docs/source-entry-decisions.md)
- [Analysis/material system design](docs/analysis-and-material-system.md)
- [Workflow and skill routing](docs/workflow-skill-routing.md)
- [GitHub readiness checklist](docs/github-readiness.md)
- [Handoff and project status](docs/handoff-project-status.md)
- [Material hub workspace](E:/Project/vision-lib/material-hub-workspace/README.md)
- [Karpathy Guidelines integration](docs/vendor/andrej-karpathy-skills.md)
