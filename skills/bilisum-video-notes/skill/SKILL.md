---
name: bilisum-video-notes
description: Generate standalone Bilibili video learning packages with BiliSum in E:\Project\hotspot-collector. Use when the user asks to summarize one Bilibili video, process selected Bilibili URLs from a favorites/list page, extract AI subtitles, create video notes, illustrated notes, multimodal enhanced notes, a mind map, screenshots, visual evidence, or a batch note index, without creating a material card.
---

# BiliSum Video Notes

Work from `E:\Project\hotspot-collector`.

## Boundary

Use this skill only for standalone video understanding. Do not collect browser pages, create a Digest, create a material card, or sync IMA. If the user needs URLs from a favorites/list page first, route to `social-browser-collection`. If the user says "做成素材" or "生成素材卡", route to `material-hub-pipeline` after BiliSum output exists.

## Workflow

1. Check BiliSum and browser state:

```text
npm.cmd run video:bilisum-status
npm.cmd run browser:status -- --platform=bilibili
```

2. If needed, start the isolated Bilibili CDP profile and run `npm.cmd run video:setup-bilisum`.
3. Generate a single-video learning package:

```text
npm.cmd run video:notes-bilibili -- --url=<video-url> --title=<optional-title>
```

4. For selected URLs from a list or BrowserObservation JSON, generate a batch index:

```text
npm.cmd run video:notes-bilibili-list -- --input=<url-list-or-observation-json> --limit=10
```

5. Return `learningPackageRef` for a single video, or `batchIndexRef` plus each result for a batch. Include openable transcript, knowledge note, illustrated note, enhanced note, mind map, visual context, and screenshots when available.

## Rules

- Prefer Bilibili AI subtitles, then platform/yt-dlp subtitles.
- Do not run ASR automatically. Return `needs_asr` when no subtitle is available.
- Batch input must already contain selected URLs. Do not perform topic filtering, LLM reranking, or automatic full-favorites crawling here.
- Treat generated notes as faithful source summaries, not verified facts.
- Never print cookies, access tokens, or API keys.
