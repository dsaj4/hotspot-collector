---
name: hotspot-intelligence-collection
description: Collect, organize, or produce material cards from current hotspot and ranking sources in E:\Project\hotspot-collector. Use for today's hotspots, current-event signals, Bilibili popular, Weibo, Zhihu, Douyin, Baidu, GitHub Trending, Hacker News, Google News AI, hotspot Digests, or hotspot material cards.
---

# Hotspot Intelligence Collection

Work from `E:\Project\hotspot-collector`.

| Intent | Command | Model use |
|---|---|---|
| 获取/更新热点 | `npm.cmd run workflow:hotspots -- --stage=collect` | none |
| 整理热点 | `npm.cmd run workflow:hotspots -- --stage=digest --limit=20` | Digest only |
| 生成热点素材卡 | `npm.cmd run workflow:hotspots -- --stage=material --limit=20` | Digest + aggregation |

The digest stage uses existing normalized data and writes a Markdown topic brief. The material stage collects first, then runs Digest and card generation.

- Scheduled runs default to collection only.
- Browser-visible social page collection belongs to `social-browser-collection`; this skill handles configured hotspot sources and hotspot material workflow.
- Treat platform heat and rank as attention signals, not verified facts.
- Return item counts, source health, normalized refs, and brief/card refs.
- Do not sync to IMA unless explicitly requested.
