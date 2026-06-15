# Luban Skill Evaluation Workspace

Source: https://github.com/LearnPrompt/luban-skill
Fetched: 2026-06-15 16:26 +08:00
Pinned commit: 89b1f0dd338345d036232e24046eabad5a64205c
Local upstream copy: `upstream/` (ignored; reference only, not an active project skill)

## Assumptions

- This is an evaluation workspace, not an installation into `skills/<name>/skill`.
- The first goal is to estimate how Luban can improve the current Hotspot Collector skills.
- No current project skill should be rewritten until a specific target skill and iteration direction are chosen.

## Vetting Summary

Luban is a skill-polishing workflow rather than a data-collection adapter. It reads skill assets, compares against external peers, scores structure and live behavior, then proposes bounded edits. It includes two shell tools:

- `check-skill-repo.sh`: checks a local skill repo or shallow-clones a GitHub repo, then reports publishing-readiness gaps.
- `scaffold-skill.sh`: creates a new public-skill repository skeleton with README, marketplace metadata, demo placeholders, and MIT license.

Risk level: medium for active use, low as a reference.

Reasons:

- It can clone GitHub repos when given a GitHub target.
- It can write many files when scaffolding a new skill.
- It uses `rm -rf` only for its own temporary clone cleanup path.
- No credential exfiltration, obfuscated code, base64 decoding, cookie access, or secret-file reads were found in static scans.

Keep it out of active project skill discovery until a human explicitly approves installation or adaptation.

## Initial Structure Check Against Current Project Skills

Using Git Bash explicitly:

```text
C:\Program Files\Git\bin\bash.exe -lc "cd /e/Project/hotspot-collector && bash skill-workspaces/luban-skill-evaluation/upstream/skills/luban/tools/check-skill-repo.sh <target>"
```

Sample results:

| Target | PASS | WARN | FAIL | Main gaps |
|---|---:|---:|---:|---|
| `skills/hotspot-collector-orchestrator/skill` | 3 | 5 | 3 | missing README, examples, scripts directory, demo, install badge |
| `skills/social-browser-collection/skill` | 3 | 5 | 3 | missing README, examples, scripts directory, demo, install badge |
| `skills/material-hub-pipeline/skill` | 2 | 5 | 4 | missing README, examples, scripts directory, agent-facing workflow keyword match, demo |
| `skills/subscription-material-collection/skill` | 3 | 5 | 3 | missing README, examples, scripts directory, demo, install badge |

Interpretation: current project skills are useful operational runbooks, but they are not packaged as public, installable, showcase-backed skill assets.

## How Luban Can Help This Project

1. Turn the core local skills into publishable assets.
   - Add per-skill README files, examples, trigger examples, validation prompts, and safety boundaries.
   - Especially useful for `social-browser-collection`, because its browser and access-control boundaries need visible trust signals.

2. Create a repeatable "skill birth certificate" checklist for this repo.
   - A local checklist can require README, examples, dry-run prompt, command verification, and "do not bypass login walls" language before a skill is considered done.

3. Separate maintenance-side and user-side triggers.
   - Current skills mostly tell the agent which npm command to run.
   - Luban's evaluation lens can expose whether a real user would know what to ask for, what artifact they get, and what stops automatically.

4. Improve showcase and verification discipline.
   - For collection workflows, showcase should be sample normalized JSON, source health output, and a redacted browser observation example.
   - For material workflows, showcase should be source item -> Digest -> card refs, with discarded-source reasoning.

5. Add iteration gates without overbuilding.
   - Start with one skill, one face: README + examples for `social-browser-collection`.
   - Then run `npm.cmd run check` and one representative command or dry-run fixture before keeping changes.

## Recommended Next Iteration

Start with `social-browser-collection`.

Why:

- It has the highest trust and safety burden.
- It already has clear boundaries in SKILL.md.
- It needs concrete user-facing artifacts: `BrowserObservation`, URL list shape, ingestion command, and "visible access only" examples.

Minimum success criteria:

```text
1. Add README and examples for social-browser-collection - verify: Luban structure check no longer fails README/examples.
2. Add 2-3 validation prompts and expected outputs - verify: a future agent can dry-run the workflow from docs alone.
3. Keep boundaries unchanged - verify: no new collection capability, no cookie/login bypass, no automatic broad crawling.
```

## Do Not Do Yet

- Do not install Luban into `skills/luban/skill`.
- Do not copy Luban's whole style wholesale into operational skills.
- Do not scaffold a new public repository from this project until the internal skill shape is stable.
- Do not add GitHub/skills.sh publishing metadata until publishing is an explicit goal.
