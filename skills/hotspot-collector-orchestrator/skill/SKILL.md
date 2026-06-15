---
name: hotspot-collector-orchestrator
description: Route user requests across the simplified Hotspot Collector skill set by user goal. Use when the user asks to collect social-media URLs through a browser, summarize Bilibili videos or batches, create material from links, organize hotspots or subscriptions, produce material cards, inspect operations, or synchronize the material hub with IMA.
---

# Hotspot Collector Orchestrator

Work from `E:\Project\hotspot-collector`. Route by desired outcome, not merely by platform.

| User goal | Skill |
|---|---|
| 浏览器采集社交媒体可见条目、URL、B站收藏夹 URL 列表 | `social-browser-collection` |
| B站总结、字幕、视频笔记、图文笔记、导图、截图证据、批量 URL 笔记 | `bilisum-video-notes` |
| 链接做成素材、素材卡、完整内容处理 | `material-hub-pipeline` |
| 获取/整理/生产时事热点 | `hotspot-intelligence-collection` |
| 更新/整理/生产长期订阅内容 | `subscription-material-collection` |
| 推送、拉取、核对、双向同步 IMA | `material-hub-ima-sync` |
| 浏览器登录态、运行健康、测试 | `social-browser-collection` for collection, otherwise project commands |

- “总结这个 B 站视频” stops at the BiliSum learning package.
- “读取这个 B 站收藏夹/列表” first extracts visible URLs with `social-browser-collection`.
- “把这些 B 站 URL 做视频笔记” uses `bilisum-video-notes` batch input.
- “把这个 B 站视频做成素材” runs BiliSum, Digest, and aggregation.
- “获取热点/更新订阅” never invokes an LLM.
- “整理热点/订阅” creates Digests and a topic brief, but not a material card.
- “生成素材卡” runs the full local production pipeline.
- IMA sync is always explicit and separate.

Use existing npm commands. Run `npm.cmd run check` after implementation changes.
