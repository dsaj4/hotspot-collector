# External Dependencies

External upstream-derived applications are kept outside the `hotspot-collector` source repository.

Recommended local root:

```text
E:\Project\hotspot-collector-external
```

Override it with:

```text
HOTSPOT_EXTERNAL_ROOT=E:/Project/hotspot-collector-external
```

Expected projects:

```text
E:\Project\hotspot-collector-external\
  BiliSum\
  wewe-rss\
```

## BiliSum

```text
origin:   https://github.com/dsaj4/BiliSum.git
upstream: https://github.com/lycohana/BiliSum.git
branch:   hotspot/ai-subtitle
```

Configure the integration with:

```text
BILISUM_PROJECT_ROOT=E:/Project/hotspot-collector-external/BiliSum
BILISUM_APP_DATA_ROOT=E:/Project/hotspot-collector-data/bilisum
```

## WeWe RSS

```text
origin:   https://github.com/dsaj4/wewe-rss.git
upstream: https://github.com/cooderl/wewe-rss.git
branch:   hotspot/wechat-official-account-adapter
```

Configure the integration with:

```text
WEWE_RSS_PROJECT_ROOT=E:/Project/hotspot-collector-external/wewe-rss
```

These repositories are not submodules. They are updated, committed, and pushed independently from `hotspot-collector`.

## Setup

```powershell
New-Item -ItemType Directory -Force E:\Project\hotspot-collector-external | Out-Null
git clone https://github.com/dsaj4/BiliSum.git E:\Project\hotspot-collector-external\BiliSum
git -C E:\Project\hotspot-collector-external\BiliSum remote add upstream https://github.com/lycohana/BiliSum.git
git -C E:\Project\hotspot-collector-external\BiliSum fetch origin
git -C E:\Project\hotspot-collector-external\BiliSum fetch upstream

git clone https://github.com/dsaj4/wewe-rss.git E:\Project\hotspot-collector-external\wewe-rss
git -C E:\Project\hotspot-collector-external\wewe-rss remote add upstream https://github.com/cooderl/wewe-rss.git
git -C E:\Project\hotspot-collector-external\wewe-rss fetch origin
git -C E:\Project\hotspot-collector-external\wewe-rss fetch upstream
```

If a directory already exists, verify remotes instead of recloning:

```powershell
git -C E:\Project\hotspot-collector-external\BiliSum remote -v
git -C E:\Project\hotspot-collector-external\wewe-rss remote -v
```

## Repository Boundaries

- Commit and push BiliSum changes in the BiliSum repository.
- Commit and push WeWe RSS changes in the WeWe RSS repository.
- Commit only integration code, docs, config templates, and tests in `hotspot-collector`.
- Do not vendor either external application back into this repository.
