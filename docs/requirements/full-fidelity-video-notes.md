# Full-Fidelity Video Notes Requirement

Current video summaries can be too compressed: they may preserve the topic while losing the video's real argument path, evidence sequence, visual references, and rhetorical structure.

This document records the target requirement. It is not implemented by the current migration.

## Problem

High-level summaries are not enough for learning packages. A useful video note should let a reader reconstruct how the video argues, not only what it concludes.

Common failure modes:

- Topic-level summary replaces the video's step-by-step reasoning.
- Examples and counterexamples are dropped.
- Visual moments, slides, screenshots, and demonstrations are not linked to the surrounding claims.
- Segment boundaries are too coarse.
- The note cannot answer "why did the author move from point A to point B?"

## Target Output

A full-fidelity video note should include:

1. Segment-level timeline with timestamps.
2. Claim/evidence/reasoning chain per segment.
3. Important visual frames or screenshots linked to timestamps.
4. Speaker intent and transitions between sections.
5. Distinction between transcript facts, inferred structure, and model commentary.
6. A compact summary only after the detailed reconstruction exists.

## Pipeline Direction

The target pipeline should be:

```text
platform subtitles or ASR
  -> timestamped transcript segments
  -> visual frame sampling
  -> segment-level reasoning extraction
  -> argument-map reconstruction
  -> long-form notes
  -> compact summary and mind map
```

The model should be instructed to preserve argument order before compressing. Compression should happen as a final derived artifact, not as the primary representation.

## BiliSum Integration

The BiliSum fork should first improve grounding:

- Use Bilibili UP subtitles and AI subtitles where available.
- Fall back to ASR when subtitles are unavailable.
- Retain timestamp granularity.
- Keep visual evidence available for note generation.

After grounding improves, the note prompt and output schema can be changed to require full-fidelity reconstruction.

## Acceptance Criteria

For a selected Bilibili video:

- The detailed note follows the video's actual section order.
- Each major claim is tied to timestamped evidence.
- Visual references are inserted where they support the argument.
- The note keeps enough detail to explain the author's reasoning path.
- A shorter summary may exist, but it must be derived from the detailed note.
