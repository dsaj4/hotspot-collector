# Data Root

`hotspot-collector` keeps runtime data outside the source repository.

Recommended local root:

```text
E:\Project\hotspot-collector-data
```

Override it with:

```text
HOTSPOT_DATA_ROOT=E:/Project/hotspot-collector-data
```

Runtime outputs are written under this root while artifact references remain stable:

```text
data/raw/...          -> %HOTSPOT_DATA_ROOT%/raw/...
data/normalized/...   -> %HOTSPOT_DATA_ROOT%/normalized/...
data/health/...       -> %HOTSPOT_DATA_ROOT%/health/...
data/secrets/...      -> %HOTSPOT_DATA_ROOT%/secrets/...
data/sessions/...     -> %HOTSPOT_DATA_ROOT%/sessions/...
reports/...           -> %HOTSPOT_DATA_ROOT%/reports/...
```

This keeps JSON references such as `data/raw/2026-06-15/example.json` compatible with existing normalized records while preventing generated data, cookies, browser profiles, SQLite files, screenshots, and notes from entering Git.

To connect old local data without moving it into the repository, copy or mount it into the external root:

```powershell
New-Item -ItemType Directory -Force E:\Project\hotspot-collector-data | Out-Null
robocopy E:\Project\hotspot-collector\data E:\Project\hotspot-collector-data /E /R:1 /W:1
```

Treat robocopy exit codes `0` through `7` as successful copy states.
