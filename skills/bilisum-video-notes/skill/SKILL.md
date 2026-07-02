---
name: bilisum-video-notes
description: Generate standalone video learning packages with BiliSum in E:\Project\hotspot-collector. Use when the user asks to summarize Bilibili URLs, selected Bilibili batches, local mp4/audio media, subtitles/transcripts, knowledge notes, detailed records, visual evidence, illustrated/enhanced notes, mind maps, or batch note indexes, without creating a material card.
---

# BiliSum Video Notes

Work from `E:\Project\hotspot-collector`.

Primary external BiliSum repo/data locations:

- Code: `E:\Project\hotspot-collector-external\BiliSum`
- BiliSum DB: `E:\Project\hotspot-collector-data\bilisum\data\video_sum.db`
- BiliSum task dirs: `E:\Project\hotspot-collector-data\bilisum\data\tasks\<task_id>\`
- Learning packages: `E:\Project\hotspot-collector-data\video-notes\<yyyy-mm-dd>\`

## Boundary

Use this skill only for standalone video understanding and BiliSum operation. Do not collect browser pages, create a Digest, create a material card, or sync IMA. If the user needs URLs from a favorites/list page first, route to `social-browser-collection`. If the user asks to turn the output into materials, route to `material-hub-pipeline` after BiliSum output exists.

## Supported Inputs

- Bilibili URL or BV id.
- Selected Bilibili URL list or BrowserObservation JSON.
- Local media supported by current BiliSum service: `.mp4`, `.mov`, `.mkv`, `.avi`, `.wmv`, `.webm`, `.flv`, `.m4v`, `.ts`, `.mpeg`, `.mpg`, `.mp3`, `.wav`, `.m4a`, `.aac`, `.flac`, `.ogg`.
- Existing transcript/subtitle-backed tasks for resummary or repair.

For Bilibili URLs, prefer platform AI subtitles and subtitle downloads before ASR. Do not start ASR for a Bilibili URL unless the user explicitly asks or the current workflow already requires it. For local mp4/audio media, ASR is expected: BiliSum extracts/converts audio with FFmpeg and then transcribes.

## Standard Checks

Before running or debugging BiliSum:

```text
npm.cmd run video:bilisum-status
npm.cmd run browser:status -- --platform=bilibili
```

Use `browser:status` mainly for Bilibili URL/cookie issues. It is not required for local mp4/audio.

If BiliSum runtime/config looks stale, run:

```text
npm.cmd run video:setup-bilisum
```

Never print cookies, SESSDATA, access tokens, API keys, or raw auth files.

## Bilibili URL Workflow

Single video:

```text
npm.cmd run video:notes-bilibili -- --url=<video-url-or-bv> --title=<optional-title>
```

Selected batch:

```text
npm.cmd run video:notes-bilibili-list -- --input=<url-list-or-observation-json> --limit=<n>
```

Return `learningPackageRef` for a single video, or `batchIndexRef` plus each batch result. Include openable refs for transcript, knowledge note, visual note, enhanced note, mind map, visual context, screenshots/frame index, and summary JSON when present.

## Local mp4/audio Workflow

BiliSum supports local media through the service/desktop path rather than the `video:notes-bilibili` CLI.

Preferred path:

1. Use the BiliSum desktop/web import flow when available.
2. For an agent-run API flow, upload or probe the local file through the running service:
   - `POST /api/v1/videos/upload?filename=<name>` with the file bytes, or
   - `POST /api/v1/videos/probe` with a local absolute path when the service process can access that path.
3. Create the task with `POST /api/v1/videos/{video_id}/tasks`.
4. Poll the task/video detail until completed or failed.

Important local media notes:

- Upload limit is currently 8 GB.
- FFmpeg/ffprobe must be available. If local mp4 fails before transcription, check audio extraction/probe errors first.
- Local video tasks use `InputType.VIDEO_FILE`; local audio tasks use `InputType.AUDIO_FILE`.
- For mp4/video, BiliSum extracts an mp3 into the task directory, then runs ASR, summary, note generation, visual evidence, and export.

## Note Modes

Current BiliSum note modes are registry-backed. The important modes are:

- `knowledge_note`: synthesized knowledge note markdown.
- `detailed_record`: sentence/segment-level structured transcript record.

When creating tasks through API, pass:

```json
{
  "note_modes": ["knowledge_note", "detailed_record"],
  "primary_note_mode": "knowledge_note"
}
```

If the user asks for only one mode, pass only that mode. Keep generated note variants as parallel outputs in `note_variants`; do not infer that a missing artifact means the mode is unsupported without checking task result JSON and artifact paths.

## Output Layers

For batch/debug work, check all three layers:

1. Batch/input layer:
   - Input JSON under `E:\Project\hotspot-collector\data\...`
   - Batch index under `E:\Project\hotspot-collector-data\video-notes\<date>\*-learning-package-index.json`
2. Learning package layer:
   - `E:\Project\hotspot-collector-data\video-notes\<date>\bilibili-<BV>-learning-package.json`
3. Raw BiliSum task layer:
   - DB: `E:\Project\hotspot-collector-data\bilisum\data\video_sum.db`
   - Files: `E:\Project\hotspot-collector-data\bilisum\data\tasks\<task_id>\`
   - Typical completed files: `transcript.txt`, `knowledge_note.md`, `summary.json`, `mindmap.json`, `visual_evidence\visual_note.md`, `visual_evidence\visual_enhanced_note.md`, `visual_evidence\visual_context.json`, `visual_evidence\frame_index.json`.

## Diagnostics And Repair

When a task is reported as interrupted or incomplete, first separate these failure classes:

- Subtitle/transcript missing.
- ASR/auth/config failure.
- LLM summary or aggregate merge failure.
- LLM returned success but the final knowledge note has low coverage.
- Export/DB sync issue.

Do not rely only on `status=completed`, `has_result=true`, or `note_variants.status=ready`. For completed tasks, inspect:

- `transcript_text` length.
- `knowledge_note_markdown` length.
- `segment_summaries` / `timeline` count.
- `chapter_groups` count.
- `note_variants[*].quality`.
- `artifacts.llm_diagnostics_json`.
- `knowledgeNoteMarkdownQualityFallback` or manual repair diagnostics when present.

Low-coverage pattern:

- Long transcript, many `timeline` / `segment_summaries`, but a very short `knowledge_note_markdown`.
- This means LLM returned a successful but incomplete note. Repair by rebuilding from structured fields (`overview`, `key_points`, `timeline`, `chapter_groups`, `segments`) and syncing `knowledge_note.md`, `summary.json`, `task_results.result_json`, `video_assets.latest_stage`, and the learning package.
- Write a `manual-merge-export-<date>.json` diagnosis file in the task directory when manually repairing.

Current code has local structured fallback for failed aggregate merges and low-coverage LLM knowledge notes. Still verify old tasks manually because they may predate the fallback.

## Bilibili Risk Control

If `video:notes-bilibili` fails with `BiliSum HTTP 400` and the detail mentions `HTTP 412`, risk control, login state, cookies, or anti-bot behavior, treat it as a Bilibili access/login/network state problem, not as a note-generation or repository-structure failure.

Next actions:

- Report the exact failing command and sanitized error detail.
- Run `npm.cmd run video:bilisum-status`.
- Run `npm.cmd run browser:status -- --platform=bilibili`.
- If the user approves using local login state, start or refresh the isolated Bilibili CDP session, log in normally, then run `npm.cmd run video:setup-bilisum` so BiliSum can use the captured cookies file.
- Do not bypass login walls, CAPTCHA, anti-bot controls, paywalls, or platform access restrictions.

## Rules

- Batch input must already contain selected URLs. Do not perform topic filtering, LLM reranking, or automatic full-favorites crawling here.
- Treat generated notes as faithful source summaries, not verified facts.
- Terminal Chinese may mojibake on Windows; do not assume file corruption from console display. Read/write JSON/Markdown as UTF-8.
- Prefer `rg`, explicit `-LiteralPath`, and repo/project virtualenvs when running diagnostics on Windows.
- Never print cookies, access tokens, API keys, or raw secret-bearing config.
