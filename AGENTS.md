# AGENTS.md

Behavioral guidelines imported from `multica-ai/andrej-karpathy-skills`.

Source:
- https://github.com/multica-ai/andrej-karpathy-skills
- Installed Codex skill: `karpathy-guidelines`

These rules apply to implementation and design work in this project.

## 1. Think Before Coding

Do not assume. Do not hide confusion. Surface tradeoffs.

Before implementing:
- State assumptions explicitly.
- If multiple interpretations exist, present them instead of choosing silently.
- If a simpler approach exists, say so.
- If something is unclear, stop and ask.

## 2. Simplicity First

Use the minimum code and architecture that solve the requested problem.

- No features beyond what was asked.
- No abstractions for single-use code.
- No speculative configurability.
- No oversized framework before there is a real need.
- If a 200-line implementation can be 50 lines, simplify it.

## 3. Surgical Changes

Touch only what the task requires.

- Do not refactor unrelated files.
- Do not change adjacent formatting or comments unless required.
- Match existing style.
- Clean up only unused code created by the current change.

Every changed line should trace directly to the task.

## 4. Goal-Driven Execution

For non-trivial work, define success criteria before implementation.

Use this shape:

```text
1. Step - verify: check
2. Step - verify: check
3. Step - verify: check
```

Weak goals such as "make it work" are not enough. Prefer verifiable goals such as:

- "Bilibili subscription adapter returns normalized JSON for a known UID."
- "Five hotspot adapters write raw snapshots and normalized JSONL."
- "Report generator exists but returns an explicit not implemented result."

## Project-Specific Guidelines

- Build subscription collection first, then hotspot adapters, then reports.
- Keep RSS XML as compatibility output; use normalized JSON/JSONL as the internal source of truth.
- Treat platform heat as a signal, not verified fact.
- Do not bypass login walls, anti-bot controls, paywalls, or platform access restrictions.
- Cookie-based sources require explicit approval and must not be enabled by default.
- Prefer file snapshots in the first implementation phase; introduce SQLite only after the raw/normalized schemas are stable.
