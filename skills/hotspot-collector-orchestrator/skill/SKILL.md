---
name: hotspot-collector-orchestrator
description: Route Hotspot Collector requests to the current focused skill set. Use when the user asks broadly to use hotspot-collector, collect social-media URLs, summarize or make notes from Bilibili videos, process selected Bilibili URLs, generate material cards, collect hotspots or subscriptions, inspect BiliSum/material-hub operations, or sync local material cards with IMA.
---

# Hotspot Collector Orchestrator

Work from `E:\Project\hotspot-collector`. This skill is only a router: pick the narrow skill that matches the user's desired output, then follow that skill.

## Current Routing

- Browser collection of visible social-media items, Bilibili favorites/list URLs, subscription pages, search pages, or login/status guidance: use `social-browser-collection`.
- Standalone Bilibili video notes, AI subtitles, transcript, screenshots, visual evidence, VLM-enhanced notes, mind map, or batch notes from a prepared URL list/BrowserObservation JSON: use `bilisum-video-notes`.
- Turn a link, BiliSum result, collected source item, or local text into Digest(s), aggregated material cards, source decisions, and material-hub records: use `material-hub-pipeline`.
- Collect or organize current hotspots/ranking sources, daily topic briefs, or hotspot-derived material inputs: use `hotspot-intelligence-collection`.
- Update or organize long-term subscription sources and subscription-derived material inputs: use `subscription-material-collection`.
- Explicitly push, pull, compare, or synchronize material-hub content with the fixed IMA knowledge base: use `material-hub-ima-sync`.

## Boundaries

- Do not run full material-card generation when the user only asks for Bilibili notes. Stop at the BiliSum learning package.
- Do not make `social-browser-collection` do topic filtering, LLM reranking, BiliSum processing, material cards, or IMA sync. It should only collect visible items and URLs.
- Do not auto-run ASR for BiliSum by default. Prefer Bilibili AI subtitles; return that ASR is needed when subtitles are unavailable unless the user explicitly asks to run ASR.
- Treat BiliSum as an isolated subsystem. Its UI and database remain usable at `http://127.0.0.1:3838` when the service is running with the Hotspot Collector data root.
- Keep IMA sync explicit and separate from collection, BiliSum notes, and material-card generation.

## Useful Commands

```powershell
npm.cmd run video:bilisum-status
npm.cmd run video:notes-bilibili -- --url=<bilibili-url> --title=<optional-title>
npm.cmd run video:notes-bilibili-list -- --input=<url-list-or-browser-observation-json> --limit=10
npm.cmd run material:process -- --input=<source-or-workspace-ref>
npm.cmd run workflow:hotspots
npm.cmd run workflow:subscriptions
npm.cmd run material:config-status
```

Run `npm.cmd run check` after code or test changes.
