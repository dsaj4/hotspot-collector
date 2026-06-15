# GitHub Readiness Checklist

Updated: 2026-05-28

## Done

- README with capabilities, commands, environment variables, scheduler, and development checks.
- `.env.example` covering optional credentials and service URLs.
- `.gitignore` excluding local snapshots, health state, scheduler state, secrets, reports, and WeWe RSS runtime output.
- `.editorconfig` and `.gitattributes` for consistent text encoding and line endings.
- Package metadata with description, license, keywords, and Node engine.
- MIT license.
- Contributing and security docs.
- GitHub Actions CI for Windows, Node 22, typecheck, and tests.
- Vitest test scaffold.
- Unit tests for environment parsing, HTTP helpers, hotspot normalization, WeChat RSS parsing, scheduler planning, and normalized output validators.
- One-shot scheduler commands: `schedule:plan` and `schedule:run`.
- Public safe fixtures for normalized subscription, hotspot, and source-health outputs.
- Public safe raw snapshot fixtures.
- `validate:fixtures` command included in `npm run check`.
- Changelog for the first project version.
- Pull request template and issue templates for bugs/source requests.
- Handoff and project status document.

## Remaining

- Initialize this directory as a git repository when ready.
- Add mocked integration tests for every source adapter.
- Decide whether the project remains internal/private or becomes publishable open source.
- Add real credentialed verification notes for Bilibili Cookie, WeChat feeds, and X API once credentials/feed setup are provided.
