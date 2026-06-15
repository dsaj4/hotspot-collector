# social-browser-collection Luban Pass

Date: 2026-06-15
Target: `E:\Project\hotspot-collector\skills\social-browser-collection\skill`
Iteration: first pass, packaging and verification assets only

## 1. Material Check

Challenge 1 - Real problem: established. The project needs a controlled path from visible social pages to normalized local JSON without turning every platform into a brittle scraper.

Challenge 2 - Unique angle: workflow and safety boundary. The skill is not a general browser agent; it is a narrow adapter from visible social UI to `BrowserObservation`, URL-list JSON, and the existing Hotspot Collector pipeline.

Challenge 3 - Installation reason: partially established. Before this pass, the skill told an agent what commands to run, but did not give a new maintainer examples, dry-run prompts, or a visible acceptance shape.

Challenge 4 - Public spreadability: weak before this pass. There was no README, no examples, and no quick validation path.

Conclusion: good material, continue polishing. Keep the scope narrow.

## 2. Peer Scan

| Peer | Link | Type | Positioning | Learn from | Do not copy |
|---|---|---|---|---|---|
| Browser Use | https://github.com/browser-use/browser-use | indirect | General browser/computer action space for AI agents | Strong quickstart, clear browser harness framing | Too broad and automation-heavy for this project skill |
| Browserbase Stagehand | https://github.com/browserbase/stagehand | indirect | Browser automation with natural language plus code | Pairs AI flexibility with code precision | Cloud/browser automation product framing is not our goal |
| Vercel agent-browser | https://github.com/vercel-labs/agent-browser | handcraft | Browser automation CLI for AI agents | Compact CLI-oriented positioning | Provider/API-key paths do not fit local-first default |
| Anthropic browser use demo | https://github.com/anthropics/claude-quickstarts | handcraft | Reference browser automation implementation | Shows end-to-end DOM inspection and extraction | It is a demo app, not a project-local social ingestion skill |
| agent-browser.dev | https://agent-browser.dev/ | handcraft | Browser automation CLI with compact text output | Clear install command and usage surface | Generic browsing engine, not social-source normalization |

## 3. Positioning

Vertical conclusion: this skill came from the project's need to collect social sources where stable RSS/API routes are missing or insufficient. Its next phase should improve trust, examples, and verification rather than add platform power.

Horizontal conclusion: peers win by being broad browser automation engines or polished browser-agent SDKs. This project should not compete there.

Cross insight: the target niche is not "AI can use any website." It is "a visible social page becomes a safe, auditable local source item."

New one-line positioning: Turn a page the user can already see into auditable social-source JSON.

## 4. Measurement

Baseline Luban structure check:

```text
PASS: 3
WARN: 5
FAIL: 3
```

Baseline gaps:

- `README.md` missing.
- `examples/` missing.
- No demo/showcase.
- No install badge or marketplace metadata, acceptable for private project-local use.

Quality scoring before first pass:

| Dimension | Weight | Score | Evidence | Main gap | Priority |
|---|---:|---:|---|---|---|
| Frontmatter and triggers | 7 | 6 | Clear name and description | Few user prompt examples | P1 |
| Workflow clarity | 12 | 9 | Commands and shapes are explicit | No separate quickstart | P1 |
| Failure modes | 12 | 9 | Boundary rules mention CAPTCHA, ASR, broad crawling | Login-wall handling not illustrated | P1 |
| Checkpoints | 6 | 4 | Ingest command exists | No dry-run prompt set | P0 |
| Executable specificity | 17 | 13 | npm commands and JSON shapes exist | No example files | P0 |
| Resource integration | 4 | 2 | Points to BiliSum/material skills | No README map | P1 |
| Architecture | 12 | 10 | Unified browser-visible entry is coherent | Not packaged | P1 |
| Live testability | 23 | 12 | `social:ingest` tests exist | No skill-level validation artifacts | P0 |
| Anti-patterns | 7 | 6 | Strong safety rules | Need prompt-level guardrails | P1 |
| Total | 100 | 71 |  |  |  |

## 5. Gap List

P0:

- Add README with quickstart, outputs, safety boundary, validation.
- Add example `BrowserObservation` and URL-list artifacts.
- Add test prompts that encode expected behavior and must-not behaviors.

P1:

- Add a real recorded demo or screenshot after a browser session is available.
- Add a project-local validation helper if prompt checks become repetitive.

P2:

- Add public install/skills.sh metadata only if this project decides to publish the skill externally.

## 6. Three Directions

Option A - clarify the current skill:

- Add README, examples, and validation prompts.
- Lowest risk. Best first pass.

Option B - visible product:

- Add a real before/after browser capture and a generated sample report showing raw -> normalized refs.
- Better showcase, but needs a live page session.

Option C - small suite:

- Split browser-visible collection by platform again, with one shared safety reference.
- Not recommended now. The current unified entry replaced older platform-specific skills for a reason.

Recommended: Option A.

## 7. First-Pass Changes

Scope:

- Add packaging and validation assets only.
- Do not change collection behavior.
- Do not add new shell scripts, network calls, cookie handling, or platform bypass logic.

Files:

- `README.md`: quickstart, examples, safety, validation.
- `examples/browser-observation-xiaohongshu.json`: sanitized ingestion example.
- `examples/bilibili-url-list.json`: selected URL-list example for BiliSum.
- `test-prompts.json`: dry-run acceptance prompts.
- `SKILL.md`: one-line pointer to README.

## 8. Verification Gate

Required checks:

- Luban structure check no longer fails README/examples.
- `npm.cmd run check` passes.
- The skill keeps visible-access-only boundaries.

## 9. Reheat List

Watch:

- Browser Use and Stagehand for how they explain browser-agent reliability without overpromising.
- Project ingestion tests for any schema drift in `BrowserObservation`.

Next entry:

- Add a real demo artifact from a controlled browser session once there is a safe page to capture.

## 10. Second Pass: Browser Use CDP Demo

User selected direction A for the real-browser sample: Browser Use attaches to the project-managed browser through CDP.

Why this route:

- Reuses the real Chrome/Edge profile launched by `npm.cmd run browser:cdp`.
- Avoids cloud browser setup and separate login flows.
- Uses read-only DOM extraction to reduce accidental clicks or platform-risky behavior.

Added:

- `scripts/browser-use-cdp-visible-collect.ps1`
- `references/browser-use-cdp-agent-guide.md`
- README section "Real Browser Demo With Browser Use CDP"

The demo intentionally does not use Browser Use cloud/profile/cookie commands. It connects to `http://127.0.0.1:<port>`, runs `state` for inspection, then runs read-only `eval` to produce a `BrowserObservation`.
