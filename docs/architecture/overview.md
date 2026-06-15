# Architecture Overview

Hotspot Collector is the orchestration repository. It owns local TypeScript workflows, source normalization, fixtures, tests, project docs, scripts, and project-specific agent skills.

It does not own runtime data or upstream-derived applications.

## Boundaries

```text
hotspot-collector
  owns:
    TypeScript source
    tests and fixtures
    config templates
    docs
    project-specific skills
    local orchestration scripts

hotspot-collector-data
  owns:
    raw snapshots
    normalized JSONL
    source health
    secrets
    browser sessions
    generated reports
    BiliSum runtime outputs
    generated video notes

hotspot-collector-external
  owns:
    BiliSum fork checkout
    WeWe RSS fork checkout
```

## Runtime Flow

```text
source access
  -> raw snapshot
  -> normalized JSON/JSONL
  -> digest/source understanding
  -> aggregate material card
  -> optional explicit IMA sync
```

Source access may come from public APIs, RSS, WeWe RSS, browser-visible collection, or BiliSum video understanding. Platform heat is treated as a signal, not verified fact.

## Video Flow

```text
social-browser-collection or explicit URL
  -> BiliSum
  -> transcript / subtitles / visual evidence / notes
  -> optional material pipeline
```

Bilibili URL acquisition is separate from video understanding. The repository should not keep a second Bilibili dynamic/subscription implementation once the migration is complete.

## Official Account Flow

```text
WeWe RSS dashboard
  -> official-account feeds
  -> Hotspot Collector RSS/JSON consumption
  -> normalized subscription records
```

The target model is generic official accounts grouped by user-defined `groups`, not company-specific data.

## Storage

Artifact references remain stable for traceability:

```text
data/raw/2026-06-15/example.json
reports/feeds/hotspots.json
```

The physical files are written under `HOTSPOT_DATA_ROOT` by default. This keeps the source repository clean while preserving existing record references.

## Development Rule

Each migration phase must leave the repository typechecked and tested unless a blocker is documented. Generated outputs, cookies, browser profiles, model artifacts, database files, screenshots, and logs must stay outside Git.
