# Social Browser Collection

`social-browser-collection` is the browser-visible collection layer for Hotspot Collector.

It is used when platform content is visible in a user-controlled browser session and should be turned into URL lists or normalized observations without bypassing platform restrictions.

## Responsibilities

- Collect visible Bilibili video URLs from favorites, search pages, home feeds, subscriptions, and selected lists.
- Collect visible Weibo, Xiaohongshu, and similar social items when access is already available in the browser.
- Help with WeWe RSS setup pages when manual dashboard interaction is required.
- Produce URL lists or `BrowserObservation` JSON for downstream ingestion.

## Non-Responsibilities

- It should not do Bilibili video understanding. Use BiliSum for that.
- It should not generate material cards directly. Use the material pipeline.
- It should not bypass login walls, anti-bot controls, paywalls, or platform restrictions.
- It should not write cookies or browser profiles into Git.

## Downstream Paths

For Bilibili video notes:

```text
BrowserObservation or selected URL list
  -> npm.cmd run video:notes-bilibili-list -- --input=...
```

For material cards:

```text
BrowserObservation or selected URL list
  -> material pipeline
```

For normalized source records:

```text
BrowserObservation
  -> npm.cmd run social:ingest -- --input=...
```

## Migration Role

During the project-structure migration, this skill replaces the old built-in Bilibili dynamic/following/subtitle collection path. Bilibili acquisition should become browser-visible URL selection plus BiliSum video understanding.
