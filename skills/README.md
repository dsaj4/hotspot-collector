# Hotspot Collector Project Skills

This directory keeps only project-specific skills for Hotspot Collector. Generic personal skills are maintained outside this repository.

Each skill follows this layout when a workspace is needed:

```text
<skill-project>/
  skill/       Runnable skill body: SKILL.md, scripts, references, assets.
  workspace/   Development notes and validation logs.
```

## Kept Skills

- `bilisum-video-notes`
- `hotspot-collector-orchestrator`
- `hotspot-intelligence-collection`
- `material-hub-ima-sync`
- `material-hub-pipeline`
- `social-browser-collection`
- `subscription-material-collection`

## Boundaries

- BiliSum behavior belongs in the external BiliSum fork; this repository's skill only orchestrates local use.
- WeWe RSS behavior belongs in the external WeWe RSS fork; this repository's skills should refer to official-account collection, not company-only wording.
- Browser collection stops at visible URL lists or observations unless a downstream ingestion command is explicitly requested.
