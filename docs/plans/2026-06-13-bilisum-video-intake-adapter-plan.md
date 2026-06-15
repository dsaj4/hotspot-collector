# BiliSum Video Intake Adapter Plan

## Summary

This plan connects BiliSum's video understanding capabilities into the hotspot-collector material hub without merging BiliSum into the main codebase.

The confirmed direction is:

- Keep BiliSum as an isolated video processing subsystem.
- Use HTTP API calls as the main integration path.
- Read local artifact files only when the API response points to reusable files.
- First version supports Bilibili URLs only.
- Audio/text acquisition prefers Bilibili AI/platform subtitles.
- ASR is not automatic in version 1. If subtitles fail, return a `needs_asr` result for later/manual handling.
- BiliSum video notes, enhanced visual notes, mindmaps, transcript segments, and visual evidence become upstream context for material-hub digest generation.

## Confirmed Requirements

### Isolation Boundary

BiliSum remains a separately runnable subsystem. The main project does not import BiliSum's FastAPI app, Electron UI, SQLite repository, Chroma knowledge index, or task worker internals.

`hotspot-collector` consumes only a normalized video processing result:

```text
BiliSum task result
-> VideoProcessingResult
-> MaterialHubSourceItem
-> SourceDigest
-> aggregated MaterialRecord
```

### Invocation Mode

The first integration uses BiliSum HTTP APIs:

```text
POST /api/v1/tasks
GET  /api/v1/tasks/{task_id}
GET  /api/v1/tasks/{task_id}/result
POST /api/v1/tasks/{task_id}/mindmap
GET  /api/v1/tasks/{task_id}/mindmap
POST /api/v1/tasks/{task_id}/visual-evidence
GET  /api/v1/tasks/{task_id}/visual-evidence
GET  /api/v1/tasks/{task_id}/visual-evidence/media/{file_name}
```

Local artifact reading is allowed for paths returned by BiliSum, especially:

- knowledge note markdown
- enhanced visual note markdown
- visual context JSON
- frame index JSON
- visual insert plan JSON
- screenshot frame files

### First-Version Scope

Version 1 only supports Bilibili video URLs.

Out of scope for version 1:

- YouTube
- local video files
- local audio files
- automatic ASR fallback
- direct sync to BiliSum local Chroma knowledge index
- replacing IMA with BiliSum knowledge features

### Acquisition Strategy

For Bilibili videos, the target strategy is:

```text
1. Bilibili AI/player subtitles
2. Bilibili/platform subtitles
3. yt-dlp subtitles
4. return needs_asr
```

ASR will be a later explicit fallback path. A missing subtitle should not force the first-version pipeline to run a speech model.

### Digest Upstream Priority

When BiliSum output is available, material-hub source text should prioritize processed video notes over raw transcript text:

```text
1. enhanced_note_markdown
2. visual_note_markdown
3. knowledge_note_markdown
4. mindmap text summary
5. visual observations summary
6. transcript segment excerpt
```

This keeps the material card readable and lets the transcript remain evidence rather than the main article body.

## BiliSum Capabilities To Reuse

### Video Notes

BiliSum already produces `knowledge_note_markdown` in `TaskResult`. This should be mapped into the video source package as the main text fallback when no visual enhanced note exists.

### Mindmap

BiliSum exposes mindmap generation and retrieval through `/mindmap`. The adapter should store the raw mindmap JSON as an artifact and also produce a compact text summary for digest context.

The text summary should include:

- root topic
- major theme nodes
- important leaf summaries
- time anchors when available

### Visual Evidence

BiliSum already supports visual evidence and graphically enhanced notes. The main project should not reimplement frame extraction.

Reusable BiliSum fields include:

- `visual_note_markdown`
- `enhanced_note_markdown`
- `context.frames`
- `context.observations`
- `context.warnings`
- `context.visual_note_path`
- `context.visual_enhanced_note_path`
- `context.frame_index_path`
- `context.visual_keyframe_plan_path`
- `context.visual_insert_plan_path`
- media endpoint for screenshot files

The plan changes from "generate screenshot evidence in hotspot-collector" to "reuse and normalize BiliSum visual evidence."

## Proposed Data Contract

Add a local adapter-level result type. This type is not a BiliSum internal model; it is the stable boundary consumed by hotspot-collector.

```ts
type VideoProcessingStatus = "completed" | "needs_asr" | "failed";

type VideoProcessingResult = {
  status: VideoProcessingStatus;
  source: {
    platform: "bilibili";
    url: string;
    videoId?: string;
    title: string;
    authorId?: string;
    authorName?: string;
    publishedAt?: string | null;
  };
  acquisition: {
    transcriptKind:
      | "ai-subtitle"
      | "platform-subtitle"
      | "yt-dlp-subtitle"
      | "asr-transcript"
      | "missing";
    provider: string;
    usedAsr: boolean;
    warnings: string[];
  };
  transcript: {
    text: string;
    segments: Array<{
      start: string;
      end: string;
      text: string;
    }>;
  };
  videoNote: {
    markdown: string;
    enhancedMarkdown?: string;
  };
  mindmap?: {
    status: string;
    json?: unknown;
    textSummary?: string;
  };
  visualEvidence: Array<{
    frameId: string;
    timestamp: string;
    timestampSeconds: number;
    imageRef: string;
    analysisImageRef?: string;
    caption?: string;
    ocrText?: string;
    keyFacts?: string[];
    semanticSummary?: string;
    importance?: number;
    shouldInsert?: boolean;
    source: "bilisum-visual-context";
  }>;
  artifacts: Array<{
    kind:
      | "task-result"
      | "transcript"
      | "video-note"
      | "enhanced-video-note"
      | "mindmap"
      | "visual-context"
      | "frame-index"
      | "visual-insert-plan"
      | "screenshot";
    ref: string;
  }>;
};
```

## Material Hub Mapping

The adapter should map `VideoProcessingResult` into the existing `MaterialHubSourceItem` shape.

Recommended mapping:

- `sourceKind`: inherit from the upstream candidate, usually `subscription`, `hotspot`, or `temporary-link`
- `platform`: `bilibili`
- `provider`: `bilisum-video-intake`
- `title`: source video title
- `url`: Bilibili video URL
- `authorId` / `authorName` / `publishedAt`: preserve when available
- `summary`: short adapter summary including transcript kind and note availability
- `contentText`: formatted video processing package
- `rawRef`: path or URL to the BiliSum task result or normalized video result
- `normalizedRef`: material-hub source item output path
- `dedupeKey`: `bilibili-video-intake:{videoId or url hash}`

The formatted `contentText` should include:

```text
# Bilibili Video Processing Package

Title:
Author:
URL:
Transcript source:
ASR used:

## Enhanced Video Note

...

## Knowledge Note

...

## Mindmap Summary

...

## Visual Evidence

[00:03:12] caption...
- OCR: ...
- Key facts: ...

## Transcript Excerpt

[00:01:05-00:01:20] ...
```

## Digest And Card Behavior

The single-source digest prompt should treat this source as a processed video package, not a raw article.

Expected digest behavior:

- Prefer BiliSum enhanced note as the main reading layer.
- Use transcript segments only as traceable support.
- Preserve video time anchors when present.
- Treat visual observations as visual evidence, not independent facts.
- Clearly separate creator opinions, factual claims, and visual/OCR observations.
- Add system tags such as `B站`, `视频`, `AI字幕`, `图文笔记`, `思维导图` when applicable.

Expected aggregation behavior:

- Video digests may be aggregated with hotspots, subscription items, project docs, or temporary links.
- The card should use the video note for readability.
- `sourceTrace` should keep the original Bilibili URL and BiliSum artifact references.
- Screenshot evidence should appear as audit/context material, not as mandatory published-card images.

## Implementation Phases

### Automatic Local Setup

The integration provides an automatic local setup command:

```text
npm run video:setup-bilisum
```

It:

- discovers a local BiliSum project
- generates and persists a stable access token
- uses `data/bilisum` as the isolated BiliSum data directory
- writes connection settings to ignored `data/secrets/bilisum.json`
- writes BiliSum process settings to `.env.hotspot-collector`
- adds that environment file to BiliSum's local git exclude
- discovers WinGet FFmpeg links when available
- starts the BiliSum service in a hidden background process
- waits for the health endpoint

Status can be checked with:

```text
npm run video:bilisum-status
```

### Phase 1: Adapter Contract And Configuration

- Add BiliSum connection config:
  - base URL
  - optional access token
  - task timeout
  - polling interval
  - visual evidence mode
- Add TypeScript types for `VideoProcessingResult`.
- Add a BiliSum API client module.
- Add tests with mocked HTTP responses.

### Phase 2: Bilibili Task Flow

- Add command:

```text
npm run video:intake-bilibili -- --url=<bilibili-url>
```

- Create BiliSum URL task.
- Poll until task completes or fails.
- Detect missing transcript and return `needs_asr`.
- Fetch task result.
- Trigger/fetch mindmap.
- Trigger/fetch visual evidence.
- Write normalized video result JSON under:

```text
data/video-intake/YYYY-MM-DD/
```

### Phase 3: Material Hub Source Mapping

- Convert video result JSON into `MaterialHubSourceItem`.
- Reuse existing material-hub export/digest/aggregate pipeline.
- Ensure the video source can be processed by:

```text
npm run material:digest-sources
npm run material:aggregate-cards
```

### Phase 4: Latest Bilibili Candidate Integration

- Connect latest Bilibili subscription/hotspot candidates to video intake.
- Keep current `collect:bilibili-subtitles` path working.
- Add a new command or mode that processes Bilibili candidates through BiliSum when configured.

### Phase 5: Real End-To-End Test

Use one real Bilibili URL and verify:

- AI/platform subtitle path is attempted first.
- ASR is not automatically called in version 1.
- BiliSum video note is returned.
- Mindmap is returned or an explicit status is preserved.
- Visual evidence is returned or an explicit status/warning is preserved.
- `VideoProcessingResult` is written.
- `MaterialHubSourceItem` is generated.
- DeepSeek digest can process the video package.
- Aggregated material card includes source trace and produces a readable short-card result.

## Acceptance Criteria

The first usable version is accepted when:

1. A Bilibili URL can be sent from hotspot-collector into the BiliSum subsystem.
2. The task completes using subtitles when subtitles are available.
3. Missing subtitles return `needs_asr` instead of running ASR automatically.
4. BiliSum video note data is normalized into a local `VideoProcessingResult`.
5. BiliSum mindmap data is attached when available.
6. BiliSum visual evidence data is reused and normalized when available.
7. A material-hub source item is created from the normalized video result.
8. The existing digest and aggregation pipeline can generate a material card from that source item.
9. The material card remains source-traceable to:
   - original Bilibili URL
   - transcript source
   - BiliSum task/result artifact
   - visual evidence artifact when present

## Risks And Mitigations

### BiliSum API Availability

Risk: BiliSum service is not running.

Mitigation: adapter should fail with a clear health/config error and should not break existing collector commands.

### Long-Running Video Tasks

Risk: video notes or visual evidence may take a long time.

Mitigation: use configurable polling timeout and preserve partial status.

### Artifact Path Coupling

Risk: BiliSum artifact paths may be local to the BiliSum process.

Mitigation: prefer API responses when possible, and copy or reference artifacts only through configured allowed directories.

### Visual Evidence Overreach

Risk: material cards may overinterpret screenshots.

Mitigation: digest prompt should treat visual evidence as observation/OCR only unless supported by transcript or note text.

### BiliSum Schema Changes

Risk: upstream BiliSum API fields may change.

Mitigation: normalize defensively and keep the boundary type stable.

## Non-Goals

- Do not replace material-hub digest or aggregation with BiliSum summaries.
- Do not make BiliSum's Chroma knowledge index the main knowledge store.
- Do not require ASR for the first version.
- Do not require BiliSum desktop UI for headless workflow.
- Do not force screenshot images into final material card prose.
