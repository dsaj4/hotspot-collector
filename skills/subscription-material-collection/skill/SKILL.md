---
name: subscription-material-collection
description: Collect, organize, or produce material cards from long-term subscription sources in E:\Project\hotspot-collector. Use for updating subscribed Bilibili creators, followings, WeChat feeds, recurring source material, subscription Digests, topic briefs, or subscription material cards.
---

# Subscription Material Collection

Work from `E:\Project\hotspot-collector`.

| Intent | Command | Model use |
|---|---|---|
| 更新订阅 | `npm.cmd run workflow:subscriptions -- --stage=collect` | none |
| 整理订阅 | `npm.cmd run workflow:subscriptions -- --stage=digest --limit=20` | Digest only |
| 订阅内容做成素材卡 | `npm.cmd run workflow:subscriptions -- --stage=material --limit=20` | Digest + aggregation |

Use `discover:bilibili-followings` and `collect:subscriptions:followings` for account management. Browser-visible favorites or page URL extraction belongs to `social-browser-collection`. Bilibili videos selected for production should pass through BiliSum before Digest processing. Do not run ASR automatically.

- Default updates stop after collection and normalization.
- Digest writes structured tags and a Markdown topic brief.
- `autoDigest` and `autoMaterialCard` remain disabled by default.
- Do not sync to IMA unless explicitly requested.
