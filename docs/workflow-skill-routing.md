# Workflow And Skill Routing

Updated: 2026-06-14

This project now separates collection, video learning notes, material-card production, and IMA sync into explicit workflows. The goal is to make the default path predictable:

- Bilibili notes and mind maps use the isolated BiliSum subsystem.
- Material cards use the full material-hub pipeline.
- Hotspot and subscription work can stop at collection, digest brief, or material-card generation.
- IMA sync is explicit and never runs as a side effect.

## Active Business Skills

| Skill | Use When | Primary Commands |
| --- | --- | --- |
| `hotspot-collector-orchestrator` | Intent is ambiguous and needs routing to the right workflow. | Reads this routing model, then delegates. |
| `social-browser-collection` | User asks to collect visible social-media items, page URLs, Bilibili favorites/list URLs, Weibo/Xiaohongshu visible streams, or WeWe RSS setup guidance. | `npm.cmd run social:ingest -- --input=<observation-json>` |
| `bilisum-video-notes` | User asks for Bilibili video notes, transcript, mind map, illustrated note, enhanced note, screenshots, or batch notes from selected Bilibili URLs. | `npm.cmd run video:notes-bilibili -- --url=<url>` |
| `material-hub-pipeline` | User asks to turn a link or source set into a material card. | `npm.cmd run material:from-link -- --url=<url>` |
| `hotspot-intelligence-collection` | User asks for general hotspot collection, hotspot digest, or hotspot material cards. | `npm.cmd run workflow:hotspots -- --stage=<collect|digest|material>` |
| `subscription-material-collection` | User asks for subscription collection, subscription digest, or subscription material cards. | `npm.cmd run workflow:subscriptions -- --stage=<collect|digest|material>` |
| `material-hub-ima-sync` | User explicitly asks to sync material outputs to IMA or reconcile IMA state. | Uses the global `ima-skill` and fixed knowledge base configuration. |

Lower-level browser, official-account, BiliSum, and maintenance actions remain available for setup and troubleshooting, but normal daily work should enter through the seven business skills above.

## Intent Routing

| User Intent | Default Path | Output |
| --- | --- | --- |
| "summarize this Bilibili video", "make notes", "mind map", "screenshots" | BiliSum only | Learning package JSON plus transcript, knowledge note, visual note, enhanced note, mind map, screenshots when available. |
| "collect this Bilibili favorites page/list", "extract URLs from this social page" | Browser collection only | BrowserObservation JSON or URL-list JSON. |
| "make notes for these selected Bilibili URLs" | BiliSum batch only | Batch learning-package index plus per-video learning packages. |
| "turn this link into a material card" | Full material-hub pipeline | Local source record, SourceDigest, aggregate material card Markdown/JSON, source audit. |
| "get/update hotspots" | Collection only | Raw snapshots, normalized hotspot JSONL, source health. |
| "organize these hotspots" | Collection plus Digest | SourceDigest JSONL and human-readable digest brief Markdown. |
| "create hotspot material card" | Collection plus Digest plus aggregate card | Reviewable material card and audit files. |
| "get/update subscriptions" | Collection only | Raw snapshots, normalized subscription JSONL, source health. |
| "organize subscriptions" | Collection plus Digest | SourceDigest JSONL and human-readable digest brief Markdown. |
| "create subscription material card" | Collection plus Digest plus aggregate card | Reviewable material card and audit files. |
| "sync to IMA" | Explicit IMA sync | IMA-side notes or knowledge-base entries, depending on command. |

## Command Examples

Standalone Bilibili learning package:

```text
npm.cmd run video:notes-bilibili -- --url=https://www.bilibili.com/video/BV1mXEv6bEQo/
```

Selected Bilibili URL batch:

```text
npm.cmd run video:notes-bilibili-list -- --input=E:\path\to\bilibili-url-list.json --limit=10
```

Create a material card from a Bilibili video:

```text
npm.cmd run material:from-link -- --url=https://www.bilibili.com/video/BV1mXEv6bEQo/ --mode=deepseek
```

Create a material card from a non-Bilibili link after extracting text with a separate extractor:

```text
npm.cmd run material:from-link -- --url=https://example.com/article --title="Article title" --content-file=E:\path\to\article.md --mode=deepseek
```

Run hotspot workflow by stage:

```text
npm.cmd run workflow:hotspots -- --stage=collect
npm.cmd run workflow:hotspots -- --stage=digest --mode=local-rule
npm.cmd run workflow:hotspots -- --stage=material --mode=deepseek
```

Run subscription workflow by stage:

```text
npm.cmd run workflow:subscriptions -- --stage=collect
npm.cmd run workflow:subscriptions -- --stage=digest --mode=local-rule
npm.cmd run workflow:subscriptions -- --stage=material --mode=deepseek
```

## Processing Rules

### BiliSum Subsystem

BiliSum is kept as an external application under `E:/Project/hotspot-collector-external/BiliSum`. Its app/runtime data is mounted under `HOTSPOT_DATA_ROOT`, usually `E:/Project/hotspot-collector-data/bilisum`. It can be used by itself and can also act as a digest upstream for the material hub.

The default standalone BiliSum package includes:

- transcript or subtitle result
- knowledge note
- illustrated video note
- multimodal enhanced note
- mind map when generated
- screenshot evidence records
- an index of openable files

The preferred order is platform subtitles first, including AI subtitles when available and allowed by normal access, then ASR fallback.

### Social Browser Collection

Browser collection is a lightweight URL and visible-item extraction layer. It does not do AI subtitle validation, topic filtering, LLM reranking, full favorites crawling, BiliSum notes, material cards, or IMA sync. Those steps are routed to the appropriate downstream skill.

Accepted handoff shapes:

```json
{
  "sourcePageUrl": "https://www.bilibili.com/...",
  "items": [
    { "title": "video title", "url": "https://www.bilibili.com/video/BV..." }
  ]
}
```

or a standard `BrowserObservation` JSON with `platform: "bilibili"`.

### Digest Stage

Digest is the first LLM-oriented material stage. It produces compact source understanding rather than final writing. It now also writes a human-readable brief so a reviewer can inspect source quality before aggregation.

Digest output includes:

- summary
- fact points
- opinion points
- verification points
- layered tags
- source trace references
- digest brief Markdown

### Aggregate Card Stage

The aggregate stage focuses on readable writing and source selection. It should not be treated as a large form-filling step.

Aggregate output includes:

- readable material card Markdown
- card JSON
- used source list
- discarded source list
- conflict notes
- gap notes
- source audit metadata

### IMA Sync

IMA sync is intentionally separate. The material pipeline can prepare local outputs, but nothing is pushed into IMA unless the user explicitly asks for IMA synchronization.

## Legacy Skill Cleanup

The following old active skills were removed after backup because their responsibilities are now covered by the seven business skills:

- `hotspot-collector-bilibili`
- `hotspot-collector-hotspots`
- `hotspot-collector-feeds-reports`
- `hotspot-collector-browser-bilibili`
- `hotspot-collector-browser-weibo`
- `hotspot-collector-browser-xiaohongshu`
- `hotspot-collector-wechat`
- `hotspot-collector-wechat-maintenance`
- `hotspot-collector-maintenance`
- global `bilibili-youtube-watcher`

Backup location:

```text
E:\Project\personal-skills\workspace\migration-backups\2026-06-14-hotspot-workflow-skills
E:\Project\personal-skills\workspace\migration-backups\2026-06-14-social-browser-skill-consolidation
```
