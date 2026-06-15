---
name: social-browser-collection
description: Collect visible social-media items and URL lists through browser sessions for Hotspot Collector. Use for Bilibili favorites, subscriptions, search pages, home feeds, hotspots, Weibo visible streams, Xiaohongshu visible notes, WeChat/WeWe RSS setup guidance, or when the user asks to extract social URLs for later BiliSum or material processing.
---

# Social Browser Collection

Work from `E:\Project\hotspot-collector`. This is the unified browser-visible collection entry. It replaces the old platform-specific browser skills.

See `README.md` for runnable examples, validation prompts, and expected artifacts.

## Boundary

Collect what the user can visibly access in the browser, then write a standard observation or URL list. Do not summarize videos, generate material cards, sync IMA, solve CAPTCHA, bypass access controls, or run ASR.

AI subtitle validation belongs to `bilisum-video-notes`, not this skill.

## Supported Targets

- Bilibili: favorites, subscriptions/following pages, search results, popular/hot pages, home feed, visible video lists.
- Weibo: visible hot/search/home/subscription streams.
- Xiaohongshu: visible note lists; each item must include body text and at least one image URL when ingested.
- WeChat: guide WeWe RSS setup and maintenance; do not scrape private WeChat pages directly.

## Workflow

1. Start or reuse the matching browser session when needed:

```text
npm.cmd run browser:cdp -- --platform=bilibili --port=9223 --url=<page-url>
npm.cmd run browser:cdp -- --platform=weibo --port=9224 --url=<page-url>
npm.cmd run browser:cdp -- --platform=xiaohongshu --port=9225 --url=<page-url>
```

2. Use the Browser or Chrome plugin to inspect the visible page. Extract only visible, user-accessible items.
3. Save either a `BrowserObservation` JSON file or a URL-list JSON file.
4. For observation ingestion, run:

```text
npm.cmd run social:ingest -- --input=<observation-json>
```

5. If the user wants Bilibili video notes, pass the selected Bilibili URLs to `bilisum-video-notes`.
6. If the user wants material cards, pass collected links or generated BiliSum outputs to `material-hub-pipeline`.

## BrowserObservation Shape

```json
{
  "sourceId": "bilibili-favorite",
  "platform": "bilibili",
  "streamType": "favorite",
  "pageUrl": "https://www.bilibili.com/...",
  "status": "ok",
  "items": [
    {
      "title": "video title",
      "url": "https://www.bilibili.com/video/BV...",
      "authorName": "optional",
      "body": "visible description if present",
      "media": []
    }
  ]
}
```

Valid `streamType` values are `subscription`, `search`, `favorite`, `hotspot`, and `home-feed`.

## URL List Shape

Use this when the next step is BiliSum batch notes and ingestion is not needed:

```json
{
  "sourcePageUrl": "https://www.bilibili.com/...",
  "items": [
    { "title": "video title", "url": "https://www.bilibili.com/video/BV..." }
  ]
}
```

Then run:

```text
npm.cmd run video:notes-bilibili-list -- --input=<url-list-or-observation-json> --limit=10
```

## Rules

- Do not do topic filtering, LLM reranking, or automatic full-favorites crawling.
- Default to visible items only. Ask before long scrolling or broad collection.
- Do not write hard-coded selectors into the skill. Use page inspection and current DOM context.
- Do not log cookies, access tokens, or private page data beyond the selected visible items.
- For Xiaohongshu ingestion, require non-empty body and at least one image URL.
- For WeChat, prefer WeWe RSS configuration and `subscription-material-collection`.
