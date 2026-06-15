# 数据入口决策

更新日期：2026-05-28

原则：优先使用真实、可验证、低风险的数据入口。平台直连优先；若直连接口不稳定，可以使用聚合源或本地 RSS 服务，但必须在 `provider` 中明确标注。需要登录态的来源只接受显式配置的 Cookie 或 Token，不做反爬绕过。

## 已确认入口

| Source ID | 用途 | 真实入口 | 类型 | 状态 |
| --- | --- | --- | --- | --- |
| `bilibili-user-dynamic` | B 站 UP 动态 | `grpc.biliapi.net` DynSpace，失败后 Web WBI fallback | 平台 API/gRPC | 已实现 |
| `bilibili-user-video` | B 站 UP 视频 | DynSpace 过滤视频，失败后 Web WBI video fallback | 平台 API/gRPC | 已实现 |
| `bilibili-followings` | B 站关注列表 | `https://api.bilibili.com/x/relation/followings` | 平台 API，需要登录 Cookie | 已实现 |
| `wechat-rss-*` | 微信公众号订阅 | 本地 WeWe RSS `/feeds/<feed>.json`，失败后 `/feeds/<feed>.rss` | 本地 RSS 服务 | 已实现 |
| `rss-*` | 通用 RSS/Atom 订阅 | source catalog 中的 `feedUrl`/`inputUrl` | 直接 RSS | 已实现 |
| `youtube-channel-*` | YouTube 频道订阅 | `https://www.youtube.com/feeds/videos.xml?channel_id=<channelId>` | 原生 RSS | 已实现 |
| `rsshub-*` | Infohub 风格订阅源 | `RSSHUB_BASE_URL` + 平台路由 | RSSHub 兼容层 | 已实现 |
| `bilibili-popular` | B 站热门 | `https://api.bilibili.com/x/web-interface/ranking/v2` | 平台 API | 已实现 |
| `weibo-hot` | 微博热搜 | `https://newsnow.busiyi.world/api/s?id=weibo&latest` | NewsNow 聚合 | 已实现 |
| `zhihu-hot` | 知乎热榜 | `https://api.zhihu.com/topstory/hot-list` | 平台 API | 已实现 |
| `douyin-hot` | 抖音热点 | `https://aweme.snssdk.com/aweme/v1/hot/search/list/` | 平台 API | 已实现 |
| `baidu-hot` | 百度热搜 | `https://top.baidu.com/api/board?platform=wise&tab=realtime` | 平台 API | 已实现 |
| `github-trending` | GitHub Trending | `https://github.com/trending?since=daily` | HTML public | 已实现 |
| `hacker-news-frontpage` | Hacker News | `https://hn.algolia.com/api/v1/search?tags=front_page` | Algolia public | 已实现 |
| `google-news-ai` | AI 新闻趋势 | Google News RSS search | RSS public | 已实现 |

## B 站 Cookie 验证

2026-05-28 已通过浏览器访问 `https://space.bilibili.com/289842886/relation/follow`，浏览器上下文中存在 `SESSDATA`、`bili_jct`、`DedeUserID`。在页面内用登录态请求关注列表接口，返回：

- HTTP 200
- API code `0`
- total `165`
- 首批返回 `20`

命令行采集仍要求用户显式提供 `BILIBILI_COOKIE`，避免自动搬运或泄露浏览器 Cookie。

## 微信 RSS 决策

微信不直接在主系统里写爬虫。主系统只消费本地 WeWe RSS 服务导出的 feed，原因：

- WeWe RSS 已处理微信读书登录、公众号订阅和 feed 生成。
- 主系统保持平台适配器边界，只读取 RSS/JSON。
- 后续可以替换为其他微信 RSS 服务，只要保持 feed URL 兼容。

本地运行目录：`company-wechat-rss/`。Dashboard：`http://127.0.0.1:4000/dash`。

## X 平台决策

X 官方 API v2 路线已移除，原因是当前无法获得可用 API 凭证。已删除的入口包括：

- 指定账号时间线
- followers 发现
- follower 时间线
- recent search 热点

后续如果恢复 X 支持，只允许走两类显式路径：

- Infohub 风格的 RSSHub 路由
- 用户主动配置的 browser-session 路径

这两类路径必须继续保留 raw snapshot、normalized JSONL 和 source health，且不得默认启用。

当前已实现 RSSHub 路由构造能力，X 用户源会映射到：

```text
<RSSHUB_BASE_URL>/twitter/user/<username>
```

该路径仍要求用户显式配置 source catalog 和 RSSHub 实例。

## 凭证和浏览器会话决策

- 本地凭证写入 `data/secrets/`，默认被 git 忽略。
- 凭证状态只展示平台、类型、更新时间和 hash 后缀，不展示原文。
- 浏览器登录使用本机 Chrome/Edge 独立 profile，存放在 `data/sessions/<platform>/`。
- 采集器不会自动打开浏览器窗口；浏览器登录必须由用户显式运行命令触发。

## RSS 输出决策

RSS/JSON Feed 是兼容输出，不是内部真相源。`feed:generate` 只读取最新 normalized JSONL：

```text
data/normalized/<date>/subscriptions.jsonl
data/normalized/<date>/hotspots.jsonl
```

输出到：

```text
reports/feeds/subscriptions.rss
reports/feeds/subscriptions.json
reports/feeds/hotspots.rss
reports/feeds/hotspots.json
```

## 冻结项

- 小红书：本阶段移除，不保留默认 source health；后续单独评估。
- 自动价值判断/素材沉淀：停留在设计阶段，不纳入当前主采集系统验收。
