# Social Browser Collection

> Turn a page the user can already see into auditable social-source JSON.

This project skill handles the narrow browser step in Hotspot Collector: inspect a visible Bilibili, Weibo, Xiaohongshu, or WeWe RSS setup page, extract only user-accessible items, then hand the result to the local pipeline as a `BrowserObservation` or URL list.

It is intentionally not a general browser automation agent. It does not solve CAPTCHA, bypass access controls, read cookies, run ASR, summarize videos, create material cards, or sync to IMA.

## When To Use

- The user asks to collect visible items from a Bilibili favorites, search, home, popular, or following page.
- The user asks to extract selected Bilibili video URLs for later BiliSum batch notes.
- The user asks to capture visible Weibo or Xiaohongshu stream items into Hotspot Collector.
- The user asks for WeWe RSS setup guidance before subscription collection.

## What It Produces

| Input | Output | Next step |
|---|---|---|
| Visible social page | `BrowserObservation` JSON | `npm.cmd run social:ingest -- --input=<observation-json>` |
| Selected Bilibili video list | URL-list JSON | `npm.cmd run video:notes-bilibili-list -- --input=<url-list-json> --limit=10` |
| WeChat/WeWe setup page | Setup guidance or source config notes | `subscription-material-collection` |

`social:ingest` writes raw snapshots, normalized social items, compatibility subscription or hotspot JSONL, and source health.

```text
data/raw/<date>/*.json
data/normalized/<date>/social-items.jsonl
data/normalized/<date>/subscriptions.jsonl
data/normalized/<date>/hotspots.jsonl
data/health/source-health.json
```

## Quick Start

Start or reuse a local browser session when the page is not already available:

```text
npm.cmd run browser:cdp -- --platform=bilibili --port=9223 --url=<page-url>
npm.cmd run browser:cdp -- --platform=weibo --port=9224 --url=<page-url>
npm.cmd run browser:cdp -- --platform=xiaohongshu --port=9225 --url=<page-url>
```

After inspecting the visible page with the Browser or Chrome tool, save one of the example shapes from `examples/`, then run:

```text
npm.cmd run social:ingest -- --input=skills/social-browser-collection/skill/examples/browser-observation-xiaohongshu.json
```

For selected Bilibili videos, skip ingestion when the next step is only BiliSum notes:

```text
npm.cmd run video:notes-bilibili-list -- --input=skills/social-browser-collection/skill/examples/bilibili-url-list.json --limit=10
```

## Trigger Prompts

- "Collect the visible items from this Bilibili favorites page."
- "Extract the video URLs I can see on this Bilibili list for BiliSum."
- "Capture these Xiaohongshu notes into a BrowserObservation."
- "Ingest this Weibo visible stream into normalized social JSON."
- "Help me set up WeWe RSS for this WeChat account, but do not scrape private WeChat pages."

## Example Artifacts

- `examples/browser-observation-xiaohongshu.json`: sanitized `BrowserObservation` accepted by `social:ingest`.
- `examples/bilibili-url-list.json`: selected Bilibili URL list for BiliSum batch notes.
- `test-prompts.json`: dry-run prompts with expected routing and guardrails.

## Real Browser Demo With Browser Use CDP

Use this path when you want Browser Use to attach to the same real Chrome/Edge window opened by this project. Browser Use documents `--cdp-url` for existing browser connections and its CLI can run JavaScript extraction commands against that connected session.

Prerequisites:

```text
browser-use doctor
```

Run a public Bilibili popular-page sample:

```text
npm.cmd run browser:cdp -- --platform=bilibili --port=9223 --url=https://www.bilibili.com/v/popular/all/
powershell -ExecutionPolicy Bypass -File skills/social-browser-collection/skill/scripts/browser-use-cdp-visible-collect.ps1 `
  -Platform bilibili `
  -Port 9223 `
  -Url "https://www.bilibili.com/v/popular/all/" `
  -StreamType hotspot `
  -Limit 8 `
  -Output data/demo/browser-use-bilibili-popular-observation.json `
  -BrowserUseOnly
```

Then ingest the generated observation:

```text
npm.cmd run social:ingest -- --input=data/demo/browser-use-bilibili-popular-observation.json
```

Agent operating rules for the CDP demo:

- Start with a public page or a page the user has already opened in the dedicated browser profile.
- The preferred deterministic path is `browser-use-script`: Browser Use connects to the project CDP browser, gets the shared extraction script from `browser:extraction-script`, runs read-only `browser-use eval`, and writes `collectionMethod: "browser-use-script"`.
- The interactive path is `browser-use-agent`: use Browser Use to inspect, click visible controls, scroll with approval, or wait for visible content, then save the same observation shape with `collectionMethod: "browser-use-agent"`.
- The final project fallback is `direct-cdp`: `browser:collect-social` executes the same shared extraction script directly over CDP and writes `collectionMethod: "direct-cdp"`.
- Keep extraction rules in `src/collection/social/browser-extraction.ts`; do not duplicate selector logic in PowerShell or skill prompts.
- Ask before changing the URL, long scrolling, clicking into items, or collecting account-specific/private pages.
- Stop on login walls, CAPTCHA, anti-bot prompts, or paywalls and return `status: "unavailable"` with a short message.
- Do not run `browser-use cookies`, `browser-use profile sync`, or cloud/profile commands for this workflow.

## Safety Boundary

- Extract only visible, user-accessible items.
- Ask before long scrolling, broad collection, or account-specific capture.
- Do not log cookies, tokens, private messages, hidden fields, or private account data.
- Do not solve CAPTCHA, bypass login walls, bypass anti-bot controls, or access paywalled content.
- Do not hard-code selectors in the skill; inspect the current page and record the observed shape.
- For Xiaohongshu ingestion, every successful item needs non-empty body text and at least one image URL.
- Valid empty observations are allowed and do not trigger fallback. `error` or `unavailable` observations can request fallback.

## Validation

Run the local project checks after changing this skill:

```text
npm.cmd run check
```

Expected behavior:

- README and examples are present.
- The skill keeps the visible-access-only boundary.
- `social:ingest` accepts the Xiaohongshu example and rejects successful Xiaohongshu items without both body text and image URL.
