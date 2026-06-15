# Security

## Secrets

This project may use cookies and API tokens for explicit, user-authorized collection. Never commit:

- `BILIBILI_COOKIE`
- `X_BEARER_TOKEN`
- local WeWe RSS auth data
- files under `data/secrets/`

The repository `.gitignore` excludes local data snapshots, generated reports, WeWe RSS runtime output, and `data/secrets/`.

## Reporting Issues

If you find a credential leak, unsafe logging path, or a source adapter that bypasses platform access controls, open a private report with:

- affected file and command
- reproduction steps
- expected safe behavior

## Adapter Policy

Adapters should prefer public or official data access. When credentials are required, the adapter must make that explicit through source health and environment variables.
