# Project Structure Migration Implementation Plan

> **Execution mode:** unattended, phased, checkpointed. Do not execute this plan from `main`; create `codex/project-structure-migration` first.

**Goal:** turn `hotspot-collector` into a clean, collaborative source repository while preserving access to old local data and externalizing the customized BiliSum and WeWe RSS projects.

**Architecture:** `hotspot-collector` owns TypeScript source, tests, fixtures, docs, config templates, and project-specific skills only. Runtime data is mounted from `E:\Project\hotspot-collector-data`. External upstream-derived applications are maintained in independent Git repositories under `E:\Project\hotspot-collector-external` and are not submodules.

**Tech Stack:** TypeScript, Node 22, Vitest, PowerShell on Windows, GitHub remotes, BiliSum Python/uv service, WeWe RSS Node/Prisma service.

---

## Confirmed Decisions

- Main repository target: publishable/collaborative source repo, not a personal all-in-one workspace.
- Old runtime data remains usable through an external local data root:
  - `E:\Project\hotspot-collector-data`
  - configurable by `HOTSPOT_DATA_ROOT`.
- External dependency root:
  - `E:\Project\hotspot-collector-external`
  - configurable by `HOTSPOT_EXTERNAL_ROOT`.
- BiliSum is maintained as an external fork:
  - local path: `E:\Project\hotspot-collector-external\BiliSum`
  - origin: `https://github.com/dsaj4/BiliSum.git`
  - upstream: `https://github.com/lycohana/BiliSum.git`
  - custom branch: `hotspot/ai-subtitle`
  - fork `master` should track upstream `master`; custom changes live on `hotspot/ai-subtitle`.
- BiliSum custom branch includes:
  - Bilibili UP/AI subtitle acquisition.
  - fallback to original ASR when subtitle acquisition fails.
  - hotspot-compatible headless service/runtime configuration.
  - future placeholder docs for full-fidelity video notes, but no implementation in this migration.
- WeWe RSS is maintained as an external fork:
  - local path: `E:\Project\hotspot-collector-external\wewe-rss`
  - origin: `https://github.com/dsaj4/wewe-rss.git`
  - upstream: `https://github.com/cooderl/wewe-rss.git`
  - custom branch: `hotspot/wechat-official-account-adapter`
  - discard current local Prisma/schema/migration drift.
  - migrate only official-account export capability from current `company-wechat-rss`.
- Official-account export model:
  - use `groups` / `group`, not `companies` / `company`.
  - output names: `official_account_articles.json` and `official_account_articles.csv`.
  - compatibility with old `companies/company` input may be temporary, but docs only describe the new model.
- Project skills:
  - keep only project-specific skills.
  - delete generic skills from this repository; they are backed up elsewhere.
- Delete `skill-workspaces/` directly.
- Delete `company-wechat-rss/` from `hotspot-collector` after migrating needed official-account export logic to external WeWe RSS fork.
- Delete old Bilibili dynamic/subscription/GRPC path; it is superseded by `social-browser-collection` plus BiliSum.
- Delete:
  - `src/vendor/rssworker-bilibili/`
  - Bilibili followings/dynamic/subtitle subscription adapters
  - CLI commands for `discover:bilibili-followings`, `collect:subscriptions:followings`, `collect:bilibili-subtitles`.
- Keep Bilibili video understanding through:
  - `social-browser-collection` for URL acquisition.
  - BiliSum for video notes, subtitles, visual evidence, mind maps, and material upstream context.
- Rename `collect:wechat` to `collect:official-accounts`; keep `collect:wechat` as one-cycle compatibility alias.
- Docs:
  - delete stale historical plans/handoff docs instead of archiving them.
  - write fresh docs reflecting current target state.
- Tests:
  - migrate tests by functional domain.
  - delete tests for removed Bilibili dynamic/subscription and old company wrapper paths.
- Execution:
  - phased commits on `codex/project-structure-migration`.
  - push branch, do not create PR automatically.
  - external repos may be cloned, committed, and pushed to their custom branches.
- Real smoke test is allowed:
  - Bilibili URL: `https://www.bilibili.com/video/BV1tfoNBqEtN`
  - use local secrets/cookies if already configured.
  - never commit generated outputs.

## Non-Negotiable Boundaries

- Do not commit secrets, cookies, browser profiles, SQLite DBs, screenshots, video/audio files, generated notes, or runtime logs.
- Do not bypass login walls, anti-bot controls, paywalls, or platform access restrictions.
- Cookie-based access may only use explicitly configured local cookies and must not be enabled by default.
- Do not add BiliSum or WeWe RSS as submodules.
- Do not keep old compatibility shims at the end of the migration.
- Every phase must leave the repository in a typechecked/tested state unless the phase explicitly documents a blocker.

## Target Repository Layout

```text
hotspot-collector/
  config/
    browser-sources.example.json
    official-accounts.example.json
    public-sources.json
    sources.example.json
  docs/
    architecture/
      overview.md
    integrations/
      bilisum.md
      social-browser-collection.md
      wewe-rss.md
    operations/
      data-root.md
      external-dependencies.md
      smoke-tests.md
    requirements/
      full-fidelity-video-notes.md
  fixtures/
  scripts/
  skills/
    bilisum-video-notes/
    hotspot-collector-orchestrator/
    hotspot-intelligence-collection/
    material-hub-ima-sync/
    material-hub-pipeline/
    social-browser-collection/
    subscription-material-collection/
  src/
    cli/
      index.ts
      commands/
    collection/
      hotspots/
      subscriptions/
      social/
    core/
    integrations/
      bilisum/
      browser/
      ima/
      wewe-rss/
    material-hub/
      intake/
      digest/
      aggregate/
      export/
      quality/
    reporting/
    sources/
    validation/
    video-notes/
      bilibili/
    workflows/
  tests/
    collection/
    core/
    integrations/
    material-hub/
    sources/
    validation/
    video-notes/
    workflows/
```

## Target Local External Layout

```text
E:\Project\hotspot-collector-external\
  BiliSum\
  wewe-rss\

E:\Project\hotspot-collector-data\
  bilisum\
  browser-sessions\
  health\
  normalized\
  raw\
  reports\
  scheduler\
  secrets\
  video-intake\
  video-notes\
  wewe-rss\
  official-accounts\
```

## Phase 0: Preflight And Branch Setup

**Files:**
- Modify none unless preflight reveals missing ignore rules.

**Steps:**
1. Verify current baseline.
   ```powershell
   git status --short --branch
   git log --oneline -1
   npm.cmd run typecheck
   npm.cmd test
   ```
   Expected: clean `main`, typecheck and tests pass or existing failures are documented before proceeding.
2. Create migration branch.
   ```powershell
   git switch -c codex/project-structure-migration
   ```
3. Reconfirm ignored runtime paths.
   ```powershell
   git status --ignored --short
   git check-ignore -v data/secrets/bilisum.json data/bilisum/cookies/bilibili.txt reports/feeds/hotspots.json .playwright-mcp/page-2026-06-11T02-24-07-263Z.yml
   ```
   Expected: all runtime paths are ignored.

**Commit:** none unless `.gitignore` needs fixes.

## Phase 1: External Roots And Data Mounts

**Files:**
- Modify: `src/config.ts`
- Modify: `src/core/storage.ts`
- Modify: `.env.example`
- Create: `docs/operations/data-root.md`
- Create: `docs/operations/external-dependencies.md`
- Test: `tests/core/storage.test.ts` or existing storage/config tests.

**Steps:**
1. Add environment variables:
   - `HOTSPOT_DATA_ROOT`
   - `HOTSPOT_EXTERNAL_ROOT`
   - `BILISUM_PROJECT_ROOT`
   - `BILISUM_APP_DATA_ROOT`
   - `WEWE_RSS_PROJECT_ROOT`
2. Default `HOTSPOT_DATA_ROOT` to `E:\Project\hotspot-collector-data` on this machine only when no env var exists. Preserve cross-platform ability by using env overrides in code and documenting Windows defaults.
3. Make storage helpers resolve runtime write paths through the data root.
4. Do not move old `data/`; copy only if needed for smoke tests:
   ```powershell
   New-Item -ItemType Directory -Force E:\Project\hotspot-collector-data | Out-Null
   robocopy E:\Project\hotspot-collector\data E:\Project\hotspot-collector-data /E /XD runtime node_modules .git /R:1 /W:1
   ```
   Treat robocopy exit codes `0..7` as success.
5. Update `.env.example` with documented variables and no secrets.
6. Add docs for data root and external root.
7. Verify:
   ```powershell
   npm.cmd run typecheck
   npm.cmd test -- tests/env.test.ts tests/scheduler.test.ts tests/validators.test.ts
   git status --short
   ```

**Commit:**
```powershell
git add .env.example src/config.ts src/core/storage.ts tests docs/operations
git commit -m "chore: add external data and dependency roots"
```

## Phase 2: Externalize BiliSum Fork

**Files in `hotspot-collector`:**
- Modify: `src/video-intake/setup.ts` or its migrated equivalent if Phase 5 has already run.
- Modify: `src/video-intake/local-config.ts`
- Modify: `scripts/start-bilisum-web.ps1`
- Create: `docs/integrations/bilisum.md`
- Create: `docs/requirements/full-fidelity-video-notes.md`
- Test: `tests/video-intake-setup.test.ts`

**External repo path:**
- `E:\Project\hotspot-collector-external\BiliSum`

**Steps:**
1. Clone or update fork.
   ```powershell
   New-Item -ItemType Directory -Force E:\Project\hotspot-collector-external | Out-Null
   git clone https://github.com/dsaj4/BiliSum.git E:\Project\hotspot-collector-external\BiliSum
   cd E:\Project\hotspot-collector-external\BiliSum
   git remote add upstream https://github.com/lycohana/BiliSum.git
   git fetch origin
   git fetch upstream
   ```
   If the directory exists, verify remotes instead of recloning.
2. Keep `master` aligned with upstream.
   ```powershell
   git switch master
   git merge --ff-only upstream/master
   git push origin master
   ```
   If fast-forward fails, stop and document the conflict; do not force push.
3. Create or update custom branch.
   ```powershell
   git switch -C hotspot/ai-subtitle master
   ```
4. Compare current local implementation from `E:\Project\vision-lib\.tmp-bilisum-analysis`:
   - `apps/service/src/video_sum_service/integrations.py`
   - `packages/core/src/video_sum_core/pipeline/real.py`
   - `apps/service/pyproject.toml`
   - `uv.lock`
5. Reimplement only the AI subtitle acquisition behavior on the new branch:
   - fetch Bilibili UP subtitles and AI subtitles where platform access allows.
   - use configured cookies if provided.
   - return transcript segments compatible with BiliSum pipeline.
   - fallback to original ASR when subtitle fetching fails.
   - add or retain only necessary dependency changes.
6. Add BiliSum-side tests if practical. If upstream has no suitable test harness, add a focused unit test around subtitle selection/parsing and document manual validation.
7. Commit and push external branch.
   ```powershell
   git add apps/service packages/core apps/service/pyproject.toml uv.lock tests
   git commit -m "feat: add hotspot Bilibili AI subtitle fallback"
   git push -u origin hotspot/ai-subtitle
   ```
8. Update `hotspot-collector` setup defaults to prefer:
   - `BILISUM_PROJECT_ROOT`
   - `E:\Project\hotspot-collector-external\BiliSum`
   - legacy paths only as fallback.
9. Make BiliSum app data default to:
   - `BILISUM_APP_DATA_ROOT`
   - then `HOTSPOT_DATA_ROOT\bilisum`
10. Update BiliSum docs and full-fidelity future requirement doc.
11. Verify:
   ```powershell
   npm.cmd run typecheck
   npm.cmd test -- tests/video-intake-setup.test.ts
   npm.cmd run video:bilisum-status
   ```

**Commit in `hotspot-collector`:**
```powershell
git add src/video-intake scripts/start-bilisum-web.ps1 docs/integrations/bilisum.md docs/requirements/full-fidelity-video-notes.md tests/video-intake-setup.test.ts
git commit -m "chore: point BiliSum integration at external fork"
```

## Phase 3: Externalize WeWe RSS Fork

**Files in `hotspot-collector`:**
- Delete: `company-wechat-rss/`
- Modify: `src/adapters/subscriptions/wechat-rss.ts` or migrated equivalent.
- Modify: `src/collectors/subscriptions.ts`
- Modify: `src/config.ts`
- Modify: `README.md`
- Create: `config/official-accounts.example.json`
- Create: `docs/integrations/wewe-rss.md`
- Test: `tests/wechat-rss.test.ts` or migrated equivalent.

**External repo path:**
- `E:\Project\hotspot-collector-external\wewe-rss`

**Steps:**
1. Clone or update fork.
   ```powershell
   git clone https://github.com/dsaj4/wewe-rss.git E:\Project\hotspot-collector-external\wewe-rss
   cd E:\Project\hotspot-collector-external\wewe-rss
   git remote add upstream https://github.com/cooderl/wewe-rss.git
   git fetch origin
   git fetch upstream
   ```
2. Keep base branch aligned with upstream if possible.
   ```powershell
   git switch main
   git merge --ff-only upstream/main
   git push origin main
   ```
   If upstream default branch is not `main`, discover and use the actual branch.
3. Create or update custom branch.
   ```powershell
   git switch -C hotspot/wechat-official-account-adapter main
   ```
4. Do not migrate current vendor Prisma/schema/migration drift.
5. Migrate official-account export capability from:
   - `company-wechat-rss/company_wechat_rss.py`
   - `company-wechat-rss/config/company_accounts.template.json`
   - relevant runtime scripts only if still useful.
6. Rename domain model:
   - `company` -> `group`
   - `companies` -> `groups`
   - `company_articles.*` -> `official_account_articles.*`
7. Add docs/tests in external WeWe RSS repo if practical.
8. Commit and push external branch.
   ```powershell
   git add .
   git commit -m "feat: add hotspot official account export"
   git push -u origin hotspot/wechat-official-account-adapter
   ```
9. In `hotspot-collector`, delete `company-wechat-rss/`.
10. Add config template and docs that point to external WeWe RSS.
11. Rename CLI command implementation from `collect:wechat` to `collect:official-accounts`, keeping `collect:wechat` as a compatibility alias.
12. Verify:
   ```powershell
   npm.cmd run typecheck
   npm.cmd test -- tests/wechat-rss.test.ts tests/rss-subscriptions.test.ts
   npm.cmd run collect:official-accounts -- --help
   ```

**Commit in `hotspot-collector`:**
```powershell
git add -A company-wechat-rss config docs/integrations/wewe-rss.md src tests README.md package.json
git commit -m "refactor: externalize WeWe RSS integration"
```

## Phase 4: Trim Skills And Workspaces

**Files:**
- Delete: `skill-workspaces/`
- Delete generic skills under `skills/`
- Keep project skills only.
- Modify: `skills/README.md`
- Modify: `docs/integrations/social-browser-collection.md`

**Keep:**
```text
skills/bilisum-video-notes/
skills/hotspot-collector-orchestrator/
skills/hotspot-intelligence-collection/
skills/material-hub-ima-sync/
skills/material-hub-pipeline/
skills/social-browser-collection/
skills/subscription-material-collection/
```

**Delete all other `skills/*`.**

**Steps:**
1. Delete `skill-workspaces/` directly.
2. Delete generic skills.
3. Update skill README to describe only project-specific skills.
4. Update docs that mention moved/deleted skills.
5. Verify no generic skill references remain:
   ```powershell
   rg -n "baoyu-|notebooklm|blog-writer|x-mentor|seo-content|copywriting|creator" skills docs README.md AGENTS.md CLAUDE.md
   ```
   Expected: no references, except historical source notes if intentionally retained.
6. Verify:
   ```powershell
   npm.cmd run typecheck
   npm.cmd test
   ```

**Commit:**
```powershell
git add -A skills skill-workspaces docs README.md
git commit -m "chore: keep only project-specific skills"
```

## Phase 5: Remove Deprecated Bilibili Subscription Path

**Files:**
- Delete: `src/vendor/rssworker-bilibili/`
- Delete: `src/adapters/subscriptions/bilibili.ts`
- Delete: `src/adapters/subscriptions/bilibili-subtitles.ts`
- Delete: `src/adapters/subscriptions/bilibili-player-subtitles.ts`
- Modify: `src/collectors/subscriptions.ts`
- Modify: `src/config.ts`
- Modify: `src/cli.ts` or migrated CLI files.
- Modify: `package.json`
- Modify: `config/public-sources.json`
- Modify docs and skills referencing Bilibili followings/dynamic/subtitle collection.
- Delete/update affected tests.

**Steps:**
1. Remove old Bilibili subscription adapters and vendor code.
2. Remove built-in source IDs:
   - `bilibili-user-dynamic`
   - `bilibili-user-video`
3. Remove CLI commands:
   - `discover:bilibili-followings`
   - `collect:subscriptions:followings`
   - `collect:bilibili-subtitles`
4. Keep BiliSum video commands.
5. Update docs/skills to say Bilibili URL acquisition is handled by `social-browser-collection`, then processed by BiliSum.
6. Update tests by deleting deprecated adapter coverage and adding a guard test that no removed commands remain in `package.json`.
7. Verify:
   ```powershell
   rg -n "rssworker-bilibili|discover:bilibili-followings|collect:bilibili-subtitles|bilibili-user-dynamic|bilibili-user-video|collect:subscriptions:followings" .
   npm.cmd run typecheck
   npm.cmd test
   ```
   Expected: no references except migration plan text.

**Commit:**
```powershell
git add -A src tests docs skills config package.json README.md
git commit -m "refactor: remove deprecated Bilibili subscription collectors"
```

## Phase 6: Reorganize Source Tree With Temporary Shims

**Files:**
- Move modules from current structure into target structure.
- Create temporary re-export shims only when needed to keep incremental compilation.

**Planned moves:**
```text
src/cli.ts -> src/cli/index.ts + src/cli/commands/*
src/adapters/hotspots/* -> src/collection/hotspots/adapters/*
src/adapters/subscriptions/rss.ts -> src/collection/subscriptions/rss.ts
src/adapters/subscriptions/rsshub.ts -> src/collection/subscriptions/rsshub.ts
src/adapters/subscriptions/wechat-rss.ts -> src/integrations/wewe-rss/client.ts
src/collectors/* -> src/collection/*
src/social/* -> src/collection/social/*
src/sources/* -> src/sources/*
src/validators/* -> src/validation/*
src/video-intake/* -> src/integrations/bilisum/* and src/video-notes/bilibili/*
src/materials/* -> src/material-hub/export/* or src/material-hub/*
src/feeds/* -> src/reporting/feeds/*
src/reports/* -> src/reporting/* if source; delete/move if generated
```

**Steps:**
1. Move one domain at a time.
2. Add temporary re-export files for old paths only if needed.
3. Update imports in source and tests.
4. After each domain move:
   ```powershell
   npm.cmd run typecheck
   ```
5. Run full tests after all moves:
   ```powershell
   npm.cmd test
   ```

**Commit:**
```powershell
git add -A src tests
git commit -m "refactor: reorganize source tree by domain"
```

## Phase 7: Reorganize Tests

**Files:**
- Move tests into:
```text
tests/core/
tests/sources/
tests/integrations/bilisum/
tests/integrations/wewe-rss/
tests/integrations/browser/
tests/collection/hotspots/
tests/collection/subscriptions/
tests/material-hub/
tests/video-notes/
tests/workflows/
tests/validation/
```

**Steps:**
1. Move tests to mirror the new source domains.
2. Delete obsolete tests for removed Bilibili dynamic/subtitle/followings and old company wrapper.
3. Update imports.
4. Verify:
   ```powershell
   npm.cmd test
   npm.cmd run typecheck
   ```

**Commit:**
```powershell
git add -A tests src
git commit -m "test: organize tests by functional domain"
```

## Phase 8: Remove Compatibility Shims

**Files:**
- Delete old path shims:
  - `src/video-intake/`
  - `src/adapters/`
  - `src/collectors/`
  - old `src/cli.ts`
  - any other shim-only directories.

**Steps:**
1. Search for old path references:
   ```powershell
   rg -n "video-intake|src/adapters|\\.\\./adapters|\\.\\./collectors|src/cli\\.ts|company-wechat-rss|rssworker-bilibili" src tests docs skills README.md package.json
   ```
2. Update or delete remaining references.
3. Remove shim files and empty directories.
4. Verify:
   ```powershell
   npm.cmd run typecheck
   npm.cmd test
   npm.cmd run validate:fixtures
   ```

**Commit:**
```powershell
git add -A src tests docs skills README.md package.json
git commit -m "chore: remove migration compatibility shims"
```

## Phase 9: Refresh Documentation

**Files:**
- Rewrite: `README.md`
- Delete stale historical docs/plans/handoff docs.
- Create:
  - `docs/architecture/overview.md`
  - `docs/integrations/bilisum.md`
  - `docs/integrations/wewe-rss.md`
  - `docs/integrations/social-browser-collection.md`
  - `docs/operations/data-root.md`
  - `docs/operations/external-dependencies.md`
  - `docs/operations/smoke-tests.md`
  - `docs/requirements/full-fidelity-video-notes.md`

**Steps:**
1. Delete old plans/handoff docs that describe old paths.
2. Rewrite README around the new current structure.
3. Document:
   - external data root.
   - external dependency root.
   - BiliSum fork branch.
   - WeWe RSS fork branch.
   - official-account export model.
   - Bilibili acquisition via social-browser-collection plus BiliSum.
   - smoke test commands.
4. Verify stale path references:
   ```powershell
   rg -n "company-wechat-rss|data/bilisum|vision-lib|\\.tmp-bilisum-analysis|rssworker-bilibili|bilibili-user-dynamic|bilibili-user-video|collect:bilibili-subtitles|discover:bilibili-followings" README.md docs skills src tests package.json
   ```
   Expected: no references except explicitly marked migration notes, preferably none outside this plan while plan exists.
5. Verify:
   ```powershell
   npm.cmd run typecheck
   npm.cmd test
   ```

**Commit:**
```powershell
git add -A README.md docs skills src tests package.json
git commit -m "docs: document cleaned project structure"
```

## Phase 10: Real Smoke Test

**Commands:**
```powershell
npm.cmd run video:bilisum-status
npm.cmd run video:notes-bilibili -- --url=https://www.bilibili.com/video/BV1tfoNBqEtN
```

**Rules:**
- May use existing local secrets/cookies.
- Outputs must go to `HOTSPOT_DATA_ROOT`.
- Do not commit generated artifacts.
- Do not print tokens/cookies.
- If it fails due to login, network, BiliSum runtime, or model API, document exact failure and next manual action; do not hide it.

**Verify after smoke test:**
```powershell
git status --short
git status --ignored --short | Select-Object -First 80
```

**Commit:** none unless docs are updated with smoke-test findings.

## Phase 11: Final Validation And Push

**Steps:**
1. Run complete checks.
   ```powershell
   npm.cmd run typecheck
   npm.cmd test
   npm.cmd run validate:fixtures
   npm.cmd run check
   ```
2. Confirm no forbidden files are tracked.
   ```powershell
   git ls-files | Select-String -Pattern '^(data|reports|\\.playwright-mcp|node_modules|company-wechat-rss|skill-workspaces)/|cookies|\\.db$|\\.mp4$|\\.m4a$|\\.part$' -CaseSensitive:$false
   ```
3. Confirm external remotes/branches.
   ```powershell
   git -C E:\Project\hotspot-collector-external\BiliSum remote -v
   git -C E:\Project\hotspot-collector-external\BiliSum branch --show-current
   git -C E:\Project\hotspot-collector-external\wewe-rss remote -v
   git -C E:\Project\hotspot-collector-external\wewe-rss branch --show-current
   ```
4. Push main migration branch.
   ```powershell
   git push -u origin codex/project-structure-migration
   ```
5. Do not create PR automatically.

## Failure Handling

- If `hotspot-collector` checks fail after a phase, stop before pushing that phase unless the failure is documented and unrelated to the phase.
- If external BiliSum push fails, keep local branch and continue main repository migration only if the main repo can still point to an existing local path; document external push as blocker.
- If external WeWe RSS push fails, keep local branch and continue only if official-account docs clearly mark the external fork branch as not pushed.
- If real smoke test fails, do not rollback structural migration; document failure in final report with the failing command and likely cause.
- Never use `git reset --hard` or destructive cleanup against old data directories during execution.

## Final Report Template

At completion, report:

```text
hotspot-collector
  branch:
  commits:
  pushed:
  validation:

BiliSum
  path:
  branch:
  pushed:
  validation:

wewe-rss
  path:
  branch:
  pushed:
  validation:

Smoke test
  url:
  result:
  output root:

Manual follow-ups
  - ...
```
