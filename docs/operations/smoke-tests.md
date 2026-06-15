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

If a BiliSum service is already running on port `3838`, verify the process path before accepting the result:

```powershell
Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -match '3838|video_sum_service|BiliSum|tmp-bilisum-analysis' } |
  Select-Object ProcessId, ExecutablePath, CommandLine
```

The valid runtime should resolve under:

```text
E:/Project/hotspot-collector-external/BiliSum
```

If it resolves under an old temporary analysis directory, restart BiliSum from the external fork before running video-note smoke tests.

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

Minimum acceptance:

- The command reaches the external BiliSum service.
- The generated package is written under `E:/Project/hotspot-collector-data` or the configured `HOTSPOT_DATA_ROOT`.
- Transcript acquisition prefers platform subtitles, including AI subtitles when available, before ASR fallback.
- The result preserves enough structure to diagnose full-fidelity note quality separately from infrastructure failures.

## Official Account Collection

Use the generic official-account command:

```text
npm.cmd run collect:official-accounts
```

Expected when local WeWe RSS is not running:

- The command exits cleanly.
- Source health reports an unavailable local service.
- No fake articles are emitted.

`collect:wechat` remains a compatibility alias only; do not add new automation around it.

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
