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
