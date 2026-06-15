# Smoke Tests

Smoke tests verify that the repository can run against the configured local external roots without committing generated artifacts.

## Preflight

```text
git status --short --branch
npm.cmd run typecheck
npm.cmd test
```

## Root Configuration

```text
npm.cmd run video:bilisum-status
```

Expected:

- BiliSum project root points at `E:/Project/hotspot-collector-external/BiliSum` or an explicit override.
- BiliSum app data points at `E:/Project/hotspot-collector-data/bilisum` or an explicit override.
- No secrets are printed.

## BiliSum Video Notes

Allowed smoke URL:

```text
https://www.bilibili.com/video/BV1tfoNBqEtN
```

Command:

```text
npm.cmd run video:notes-bilibili -- --url=https://www.bilibili.com/video/BV1tfoNBqEtN
```

Rules:

- Existing local cookies/secrets may be used if already configured.
- Outputs must go to `HOTSPOT_DATA_ROOT`.
- Do not commit generated notes, screenshots, audio/video files, temporary files, or logs.
- If the test fails because of login, network, runtime, or model API setup, document the exact failing command and likely cause.

## Final Checks

```text
npm.cmd run validate:fixtures
npm.cmd run check
git status --short
```

Inspect ignored outputs if needed:

```text
git status --ignored --short
```
