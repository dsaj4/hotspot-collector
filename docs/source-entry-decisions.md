# Source Entry Decisions

Updated: 2026-06-15

Principle: prefer real, verifiable, low-risk source access. Public and RSS-compatible sources are preferred. Credentialed paths must be explicitly configured and must return source health when credentials are missing.

## Active Entries

| Source | Purpose | Entry | Status |
| --- | --- | --- | --- |
| Bilibili popular | Hotspot ranking | `https://api.bilibili.com/x/web-interface/ranking/v2` | Active |
| Weibo hot | Hot search signal | NewsNow-compatible API | Active |
| Zhihu hot | Hot list signal | Public hot-list API | Active |
| Douyin hot | Hot search signal | Public hot-search endpoint | Active |
| Baidu hot | Hot search signal | Public board API | Active |
| GitHub Trending | Technical trend signal | `https://github.com/trending` | Active |
| Hacker News | Technical/community trend signal | Algolia front-page API | Active |
| Google News AI | AI news signal | Google News RSS | Active |
| Generic RSS/Atom | Subscription content | Source catalog `feedUrl` / `inputUrl` | Active |
| YouTube RSS | Subscription content | Native YouTube channel RSS | Active |
| WeWe RSS | WeChat official-account feeds | Local WeWe RSS JSON/RSS feed | Active, external app |
| Social browser observations | Visible social URLs/items | `social-browser-collection` output | Active |
| BiliSum | Bilibili video understanding | External BiliSum service | Active integration |

## Removed Entries

The old built-in Bilibili dynamic/following/subtitle collection path has been removed. Future Bilibili acquisition should use visible URL selection through `social-browser-collection`, followed by BiliSum for video understanding.

Removed source IDs and commands:

```text
bilibili-user-dynamic
bilibili-user-video
discover:bilibili-followings
collect:subscriptions:followings
collect:bilibili-subtitles
```

## WeChat Official Accounts

WeChat public-account collection is routed through external WeWe RSS:

```text
E:/Project/hotspot-collector-external/wewe-rss
```

Hotspot Collector consumes local WeWe RSS feed output and normalizes it. New docs and exports should use official-account wording:

```text
groups
group
official_account_articles.json
official_account_articles.csv
```

Avoid company-specific names for new work.

Primary command:

```text
collect:official-accounts
```

Temporary compatibility alias:

```text
collect:wechat
```

Do not introduce new `company_*`, `companies`, or company-only concepts unless a future source truly requires company-specific metadata.

## Bilibili Video Notes

Bilibili video understanding is routed through external BiliSum:

```text
E:/Project/hotspot-collector-external/BiliSum
```

The custom BiliSum branch tries Bilibili platform subtitles, including AI subtitles when available, before falling back to ASR. The full-fidelity note requirement is tracked separately in `docs/requirements/full-fidelity-video-notes.md`.

## X Platform

Official X API v2 collection is intentionally unsupported in this phase because stable API access is not available.

Future support may use only explicit, user-configured paths:

- RSSHub-compatible routes.
- User-controlled browser-session observations.

Neither path should be enabled by default.

## Credentials And Sessions

- Local credentials are written under the external data root.
- Redacted status may show platform, type, updated time, and hash suffix only.
- Browser profiles are user-controlled and stored under the external data root.
- Collectors must not auto-open login windows or copy browser cookies.
- Missing credentials must produce explicit unavailable health, not fake success.

## Feed Output

RSS/JSON Feed files are compatibility outputs, not the internal source of truth. `feed:generate` reads normalized JSONL and writes feed files under `HOTSPOT_DATA_ROOT/reports`.
