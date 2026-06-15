# Andrej Karpathy Skills Integration

Updated: 2026-05-27

Source repository: https://github.com/multica-ai/andrej-karpathy-skills

Installed Codex skill:

```text
karpathy-guidelines -> C:\Users\Administrator\.codex\skills\karpathy-guidelines
```

Project-level files added:

- `CLAUDE.md`
- `.cursor/rules/karpathy-guidelines.mdc`

## Guidance Applied To This Project

The design should follow four constraints:

1. Think before coding: state assumptions, ambiguities, and tradeoffs.
2. Simplicity first: build the minimum collector before adding dashboards, push channels, LLM analysis, or complex storage.
3. Surgical changes: subscription, hotspot, storage, and report modules should stay separated.
4. Goal-driven execution: each implementation phase needs verification criteria.

## Project Interpretation

For hotspot collection, this means:

- Bilibili subscription is the first concrete adapter.
- Xiaohongshu is explicitly optional until public-access stability is verified.
- RSSHub is a fallback/reference, not the main dependency.
- The first hotspot milestone is five working channels, not every possible platform.
- Reports remain a placeholder until collection is stable.

Restart Codex to pick up newly installed global skills.
