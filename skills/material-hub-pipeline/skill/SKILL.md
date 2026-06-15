---
name: material-hub-pipeline
description: Turn a link or collected source into source items, single-source Digests, readable aggregated material cards, source decisions, verification notes, and local Markdown/JSON artifacts. Use when the user asks to make material, generate a material card, process collected content, or run the complete content-production pipeline.
---

# Material Hub Pipeline

Work from `E:\Project\hotspot-collector`. Write material artifacts to `HOTSPOT_DATA_ROOT\material-hub-workspace`, or to `MATERIAL_WORKSPACE_ROOT\material-hub-workspace` when explicitly overridden.

## Route

- Bilibili link plus “总结/笔记/导图” -> `bilisum-video-notes`.
- Social page or favorites/list URL extraction -> `social-browser-collection` first.
- Any link plus “做成素材/素材卡” -> complete pipeline.
- Multiple existing sources -> Digest, then aggregate related sources.

## Single Link

```text
npm.cmd run material:from-link -- --url=<url> --title=<optional-title>
```

For Bilibili this runs BiliSum first, then an isolated Digest and aggregation. A single link must not include other items from the same day. For other pages, acquire readable source text with the appropriate extraction skill, then pass it with:

```text
npm.cmd run material:from-link -- --url=<url> --content-file=<extracted-markdown>
```

## Existing Sources

```text
npm.cmd run material:digest-sources -- --day=YYYY-MM-DD --limit=20
npm.cmd run material:aggregate-cards -- --day=YYYY-MM-DD --limit=8
```

Digest generation also writes a human-readable `digest-brief*.md`. Return source/Digest refs, card Markdown/JSON refs, used/discarded sources, verification gaps, and reports. Keep IMA sync separate.
