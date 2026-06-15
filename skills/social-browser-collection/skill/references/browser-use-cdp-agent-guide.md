# Browser Use CDP Agent Guide

Purpose: attach Browser Use to the real Chrome/Edge session opened by Hotspot Collector and produce a `BrowserObservation` without broad automation.

## Sources

- Browser Use CLI supports real Chrome/profile sessions, `--cdp-url`, `state`, screenshots, JavaScript `eval`, and persistent sessions.
- Browser Use browser settings include `cdp_url` for connecting to an existing browser instance.

## Operator Prompt

Use this prompt when delegating the collection step to an agent:

```text
You are collecting visible social-page items for Hotspot Collector.

Connect to the existing browser through CDP. Inspect the current visible page only.
Return a BrowserObservation JSON object with sourceId, platform, streamType, pageUrl, status, capturedAt, and items.

Allowed:
- browser-use state
- browser-use eval with read-only DOM JavaScript
- browser-use screenshot when evidence is requested

Not allowed:
- clicking, typing, form submission, login, CAPTCHA handling, cookie reads, profile sync, cloud browser provisioning
- long scrolling or broad collection without explicit user approval
- collecting hidden/private/account-only data beyond visible selected items

Stop and return status "unavailable" if the page shows a login wall, CAPTCHA, anti-bot prompt, or paywall.
```

## Command Sequence

```text
npm.cmd run browser:cdp -- --platform=bilibili --port=9223 --url=https://www.bilibili.com/v/popular/all/
browser-use --session hotspot-social --cdp-url http://127.0.0.1:9223 open https://www.bilibili.com/v/popular/all/
browser-use --session hotspot-social state
powershell -ExecutionPolicy Bypass -File skills/social-browser-collection/skill/scripts/browser-use-cdp-visible-collect.ps1 -Platform bilibili -Port 9223 -Url "https://www.bilibili.com/v/popular/all/" -StreamType hotspot -Limit 8 -Output data/demo/browser-use-bilibili-popular-observation.json
npm.cmd run social:ingest -- --input=data/demo/browser-use-bilibili-popular-observation.json
```

## Acceptance

- Output is valid JSON accepted by `social:ingest`.
- Page interaction is read-only.
- Any login wall or CAPTCHA is represented as `status: "unavailable"`, not bypassed.
