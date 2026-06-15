# BiliSum Integration

BiliSum is maintained as an external fork, not as a submodule or vendored directory.

## Repository

```text
path:     E:/Project/hotspot-collector-external/BiliSum
origin:   https://github.com/dsaj4/BiliSum.git
upstream: https://github.com/lycohana/BiliSum.git
branch:   hotspot/ai-subtitle
```

`master` should remain close to upstream. Hotspot-specific changes belong on `hotspot/ai-subtitle`.

## Configuration

```text
BILISUM_PROJECT_ROOT=E:/Project/hotspot-collector-external/BiliSum
BILISUM_APP_DATA_ROOT=E:/Project/hotspot-collector-data/bilisum
BILISUM_BASE_URL=http://127.0.0.1:3838
BILISUM_ACCESS_TOKEN=
```

`BILISUM_ACCESS_TOKEN` may also be read from the local ignored BiliSum config. Do not commit tokens or cookies.

## Commands

```text
npm.cmd run video:bilisum-status
npm.cmd run video:setup-bilisum
npm.cmd run video:notes-bilibili -- --url=https://www.bilibili.com/video/BV1tfoNBqEtN
npm.cmd run video:notes-bilibili-list -- --input=E:\path\to\bilibili-url-list.json --limit=10
```

## Target Custom Behavior

The custom BiliSum branch should try platform subtitles before ASR:

1. Fetch Bilibili UP-provided subtitles when available.
2. Fetch Bilibili AI subtitles when available and allowed by normal platform access.
3. Convert subtitle records into BiliSum-compatible transcript segments.
4. Fall back to upstream ASR behavior when subtitle acquisition fails.

This fixes the previous problem where video notes could become too coarse because the pipeline lacked enough transcript/visual grounding.

## Boundaries

- Do not bypass login walls, anti-bot controls, paywalls, or platform restrictions.
- Cookie use must be explicit local configuration and disabled by default.
- Generated video packages belong under `HOTSPOT_DATA_ROOT`, not this repository.
- Full-fidelity video-note reconstruction is a separate requirement, documented in `docs/requirements/full-fidelity-video-notes.md`.
