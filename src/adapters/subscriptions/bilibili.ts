import type { FollowedUser, SourceHealth, SourceStatus, SubscriptionItem } from "../../types.js";
import { sha1 } from "../../core/hash.js";
import { nowIso } from "../../core/time.js";
import { writeRawSnapshot } from "../../core/storage.js";
import { CloseDynSession, GetDynSpace } from "../../vendor/rssworker-bilibili/bilibili/grpc_helper_node.js";
import { createHash } from "node:crypto";

type BiliModuleAuthor = {
  ptimeLabelText?: string;
  author?: { name?: string };
};

type BiliModuleDesc = {
  text?: string;
};

type BiliModule = {
  moduleType?: string;
  moduleAuthor?: BiliModuleAuthor;
  moduleDesc?: BiliModuleDesc;
};

type BiliDynamicCard = {
  cardType?: string;
  extend?: {
    dynIdStr?: string;
    origName?: string;
    origDesc?: Array<{ text?: string }>;
    desc?: Array<{ text?: string }>;
    origImgUrl?: string;
    opusSummary?: { covers?: Array<{ src?: string }> };
  };
  modules?: BiliModule[];
};

type DynamicCollection = {
  dynamicItems: SubscriptionItem[];
  videoItems: SubscriptionItem[];
  rawRefs: string[];
  health: SourceHealth[];
};

type BilibiliSubscriptionOptions = {
  cookie?: string;
  dynamicSourceId?: string;
  videoSourceId?: string;
};

const mixinKeyEncTab = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38,
  41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52
];

function parseRelativeTime(label: string | undefined): string | null {
  if (!label) return null;
  const now = Date.now();
  const number = Number.parseInt(label, 10);
  if (label.includes("分钟前") && Number.isFinite(number)) return new Date(now - number * 60_000).toISOString();
  if (label.includes("小时前") && Number.isFinite(number)) return new Date(now - number * 3_600_000).toISOString();
  if (label.includes("天前") && Number.isFinite(number)) return new Date(now - number * 86_400_000).toISOString();
  if (label.includes("刚刚")) return new Date(now).toISOString();
  return null;
}

function textFromParts(parts: Array<{ text?: string }> | undefined): string {
  return parts?.map((part) => part.text ?? "").join("").trim() ?? "";
}

function getAuthor(card: BiliDynamicCard, uid: string): string {
  const module = card.modules?.find((item) => item.moduleType === "module_author");
  return module?.moduleAuthor?.author?.name ?? card.extend?.origName ?? uid;
}

function getPublishedAt(card: BiliDynamicCard): string | null {
  const module = card.modules?.find((item) => item.moduleType === "module_author");
  return parseRelativeTime(module?.moduleAuthor?.ptimeLabelText);
}

function getTitle(card: BiliDynamicCard): string {
  const descModule = card.modules?.find((item) => item.moduleType === "module_desc");
  return (
    descModule?.moduleDesc?.text?.trim() ||
    textFromParts(card.extend?.origDesc) ||
    textFromParts(card.extend?.desc) ||
    `${card.cardType ?? "dynamic"} ${card.extend?.dynIdStr ?? ""}`.trim()
  );
}

function mediaFromCard(card: BiliDynamicCard): string[] {
  const media: string[] = [];
  if (card.extend?.origImgUrl) media.push(card.extend.origImgUrl);
  for (const cover of card.extend?.opusSummary?.covers ?? []) {
    if (cover.src) media.push(cover.src);
  }
  return media;
}

function getMixinKey(original: string): string {
  return mixinKeyEncTab.map((index) => original[index]).join("").slice(0, 32);
}

function signWbi(params: Record<string, string | number>, imgKey: string, subKey: string): string {
  const mixinKey = getMixinKey(imgKey + subKey);
  const signed: Record<string, string | number> = { ...params, wts: Math.round(Date.now() / 1000) };
  const query = Object.keys(signed)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(signed[key]).replace(/[!'()*]/g, ""))}`)
    .join("&");
  const wRid = createHash("md5").update(query + mixinKey).digest("hex");
  return `${query}&w_rid=${wRid}`;
}

async function getBilibiliWebAuth(explicitCookie = ""): Promise<{ cookie: string; imgKey: string; subKey: string }> {
  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
  let cookie = explicitCookie.trim();
  if (!cookie) {
    const home = await fetch("https://www.bilibili.com/", { headers: { "User-Agent": userAgent } });
    const cookies = typeof home.headers.getSetCookie === "function" ? home.headers.getSetCookie() : [];
    cookie = cookies.map((item) => item.split(";")[0]).join("; ");
  }
  const nav = (await fetch("https://api.bilibili.com/x/web-interface/nav", {
    headers: { "User-Agent": userAgent, Cookie: cookie }
  }).then((response) => response.json())) as { data?: { wbi_img?: { img_url?: string; sub_url?: string } } };
  const imgUrl = nav.data?.wbi_img?.img_url ?? "";
  const subUrl = nav.data?.wbi_img?.sub_url ?? "";
  const imgKey = imgUrl.split("/").pop()?.split(".")[0] ?? "";
  const subKey = subUrl.split("/").pop()?.split(".")[0] ?? "";
  if (!imgKey || !subKey) throw new Error("Unable to read Bilibili WBI keys.");
  return { cookie, imgKey, subKey };
}

async function fetchBilibiliJson(url: string, cookie: string, uid: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      Referer: `https://space.bilibili.com/${uid}/dynamic`,
      Cookie: cookie
    }
  });
  if (!response.ok) throw new Error(`Bilibili Web API returned HTTP ${response.status}.`);
  return response.json();
}

async function collectBilibiliWebFallback(uid: string, capturedAt: string, reason: string, options: BilibiliSubscriptionOptions = {}): Promise<DynamicCollection> {
  const auth = await getBilibiliWebAuth(options.cookie);
  const dynamicSourceId = options.dynamicSourceId ?? "bilibili-user-dynamic";
  const videoSourceId = options.videoSourceId ?? "bilibili-user-video";
  const dynamicQuery = signWbi({ host_mid: uid }, auth.imgKey, auth.subKey);
  const videoQuery = signWbi({ mid: uid, pn: 1, ps: 20, order: "pubdate" }, auth.imgKey, auth.subKey);
  const dynamicResult = await fetchBilibiliJson(`https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?${dynamicQuery}`, auth.cookie, uid)
    .then((raw) => ({ ok: true as const, raw }))
    .catch((error) => ({ ok: false as const, error }));
  const videoResult = await fetchBilibiliJson(`https://api.bilibili.com/x/space/wbi/arc/search?${videoQuery}`, auth.cookie, uid)
    .then((raw) => ({ ok: true as const, raw }))
    .catch((error) => ({ ok: false as const, error }));
  const dynamicRaw = (dynamicResult.ok ? dynamicResult.raw : {}) as {
    data?: { items?: Array<{ id_str?: string; modules?: { module_author?: { name?: string; pub_time?: string }; module_dynamic?: { desc?: { text?: string }; major?: { archive?: { title?: string; jump_url?: string; cover?: string } } } } }> };
  };
  const videoRaw = (videoResult.ok ? videoResult.raw : {}) as {
    data?: { list?: { vlist?: Array<{ bvid?: string; title?: string; description?: string; created?: number; pic?: string }> } };
  };
  const dynamicRawRef = dynamicResult.ok
    ? await writeRawSnapshot("bilibili-user-dynamic-web", { provider: "bilibili-web-wbi", fallbackReason: reason, ...dynamicRaw })
    : "";
  const videoRawRef = videoResult.ok
    ? await writeRawSnapshot("bilibili-user-video-web", { provider: "bilibili-web-wbi", fallbackReason: reason, ...videoRaw })
    : "";
  const dynamicRows = dynamicRaw.data?.items ?? [];
  const videoRows = videoRaw.data?.list?.vlist ?? [];

  const dynamicItems = dynamicRows.map((row) => {
    const url = `https://t.bilibili.com/${row.id_str ?? sha1(JSON.stringify(row)).slice(0, 16)}`;
    const title =
      row.modules?.module_dynamic?.major?.archive?.title ?? row.modules?.module_dynamic?.desc?.text ?? `dynamic ${row.id_str ?? ""}`;
    return {
      id: `bilibili-${row.id_str ?? sha1(url).slice(0, 16)}`,
      sourceId: dynamicSourceId,
      platform: "bilibili",
      provider: options.cookie ? "bilibili-web-wbi-cookie" : "bilibili-web-wbi",
      authorId: uid,
      authorName: row.modules?.module_author?.name ?? uid,
      title,
      url,
      publishedAt: row.modules?.module_author?.pub_time ?? null,
      capturedAt,
      summary: row.modules?.module_dynamic?.desc?.text ?? "",
      media: [row.modules?.module_dynamic?.major?.archive?.cover].filter((item): item is string => Boolean(item)),
      rawRef: dynamicRawRef,
      dedupeKey: `bilibili:${uid}:${url}`
    };
  });

  const videoItems = videoRows.map((row) => {
    const url = `https://www.bilibili.com/video/${row.bvid ?? sha1(JSON.stringify(row)).slice(0, 16)}`;
    return {
      id: `bilibili-${row.bvid ?? sha1(url).slice(0, 16)}`,
      sourceId: videoSourceId,
      platform: "bilibili",
      provider: options.cookie ? "bilibili-web-wbi-cookie" : "bilibili-web-wbi",
      authorId: uid,
      authorName: uid,
      title: row.title ?? url,
      url,
      publishedAt: row.created ? new Date(row.created * 1000).toISOString() : null,
      capturedAt,
      summary: row.description ?? "",
      media: [row.pic].filter((item): item is string => Boolean(item)),
      rawRef: videoRawRef,
      dedupeKey: `bilibili:${uid}:${url}`
    };
  });

  return {
    dynamicItems,
    videoItems,
    rawRefs: [dynamicRawRef, videoRawRef].filter(Boolean),
    health: [
      {
        sourceId: dynamicSourceId,
        status: dynamicResult.ok ? (dynamicItems.length ? "ok" : "empty") : "error",
        checkedAt: capturedAt,
        provider: options.cookie ? "bilibili-web-wbi-cookie" : "bilibili-web-wbi",
        itemCount: dynamicItems.length,
        message: dynamicResult.ok
          ? dynamicItems.length ? `gRPC fallback used: ${reason}` : `No public dynamic items returned. gRPC fallback reason: ${reason}`
          : `gRPC failed: ${reason}; Web WBI dynamic failed: ${dynamicResult.error instanceof Error ? dynamicResult.error.message : String(dynamicResult.error)}`
      },
      {
        sourceId: videoSourceId,
        status: videoResult.ok ? (videoItems.length ? "ok" : "empty") : "error",
        checkedAt: capturedAt,
        provider: options.cookie ? "bilibili-web-wbi-cookie" : "bilibili-web-wbi",
        itemCount: videoItems.length,
        message: videoResult.ok
          ? videoItems.length ? `gRPC fallback used: ${reason}` : `No public video items returned. gRPC fallback reason: ${reason}`
          : `gRPC failed: ${reason}; Web WBI video failed: ${videoResult.error instanceof Error ? videoResult.error.message : String(videoResult.error)}`
      }
    ]
  };
}

function toSubscriptionItem(card: BiliDynamicCard, uid: string, sourceId: string, rawRef: string, capturedAt: string): SubscriptionItem {
  const originalId = card.extend?.dynIdStr ?? sha1(JSON.stringify(card)).slice(0, 16);
  const url = `https://t.bilibili.com/${originalId}`;
  const authorName = getAuthor(card, uid);
  return {
    id: `bilibili-${originalId}`,
    sourceId,
    platform: "bilibili",
    provider: "bilibili-grpc",
    authorId: uid,
    authorName,
    title: getTitle(card),
    url,
    publishedAt: getPublishedAt(card),
    capturedAt,
    summary: textFromParts(card.extend?.origDesc) || textFromParts(card.extend?.desc),
    media: mediaFromCard(card),
    rawRef,
    dedupeKey: `bilibili:${uid}:${url}`
  };
}

export async function collectBilibiliSubscriptions(uid: string, options: BilibiliSubscriptionOptions = {}): Promise<DynamicCollection> {
  const capturedAt = nowIso();
  const dynamicSourceId = options.dynamicSourceId ?? "bilibili-user-dynamic";
  const videoSourceId = options.videoSourceId ?? "bilibili-user-video";
  try {
    const response = await GetDynSpace(uid);
    if (typeof response !== "string") {
      throw new Error("DynSpace returned a non-string response.");
    }
    const raw = JSON.parse(response) as { list?: BiliDynamicCard[] };
    const rawRef = await writeRawSnapshot("bilibili-user-dynspace", raw);
    const cards = Array.isArray(raw.list) ? raw.list : [];
    const dynamicItems = cards.map((card) => toSubscriptionItem(card, uid, dynamicSourceId, rawRef, capturedAt));
    const videoItems = cards
      .filter((card) => card.cardType === "av")
      .map((card) => toSubscriptionItem(card, uid, videoSourceId, rawRef, capturedAt));
    const status: SourceStatus = cards.length ? "ok" : "empty";

    const collection: DynamicCollection = {
      dynamicItems,
      videoItems,
      rawRefs: [rawRef],
      health: [
        {
          sourceId: dynamicSourceId,
          status,
          checkedAt: capturedAt,
          provider: "bilibili-grpc",
          itemCount: dynamicItems.length,
          message: cards.length ? undefined : "DynSpace returned an empty list."
        },
        {
          sourceId: videoSourceId,
          status: videoItems.length ? "ok" : cards.length ? "empty" : status,
          checkedAt: capturedAt,
          provider: "bilibili-grpc",
          itemCount: videoItems.length,
          message: videoItems.length ? undefined : "No video cards were available from DynSpace."
        }
      ]
    };
    CloseDynSession();
    return collection;
  } catch (error) {
    CloseDynSession();
    try {
      return await collectBilibiliWebFallback(uid, capturedAt, error instanceof Error ? error.message : String(error), options);
    } catch (fallbackError) {
      const message = `gRPC failed: ${error instanceof Error ? error.message : String(error)}; Web WBI failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`;
    return {
      dynamicItems: [],
      videoItems: [],
      rawRefs: [],
      health: [
        {
          sourceId: dynamicSourceId,
          status: "error",
          checkedAt: capturedAt,
          provider: "bilibili-grpc",
          message
        },
        {
          sourceId: videoSourceId,
          status: "error",
          checkedAt: capturedAt,
          provider: "bilibili-grpc",
          message
        }
      ]
    };
    }
  }
}

export async function collectBilibiliFollowings(uid: string, cookie: string, limit: number): Promise<{ users: FollowedUser[]; rawRefs: string[]; health: SourceHealth[] }> {
  const capturedAt = nowIso();
  const sourceId = "bilibili-followings";
  if (!cookie.trim()) {
    return {
      users: [],
      rawRefs: [],
      health: [
        {
          sourceId,
          status: "unavailable",
          checkedAt: capturedAt,
          provider: "bilibili-web-cookie",
          message: "BILIBILI_COOKIE is required to fetch followings."
        }
      ]
    };
  }

  const allUsers: FollowedUser[] = [];
  const rawRefs: string[] = [];
  let page = 1;
  try {
    while (allUsers.length < limit) {
      const url = `https://api.bilibili.com/x/relation/followings?vmid=${encodeURIComponent(uid)}&pn=${page}&ps=${Math.min(50, limit)}&order=desc`;
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
          Referer: `https://space.bilibili.com/${uid}/fans/follow`,
          Cookie: cookie
        }
      });
      if (!response.ok) throw new Error(`Bilibili followings returned HTTP ${response.status}.`);
      const raw = (await response.json()) as { code?: number; message?: string; data?: { list?: Array<{ mid?: number; uname?: string; face?: string; sign?: string }> } };
      const rawRef = await writeRawSnapshot(`${sourceId}-page-${page}`, raw);
      rawRefs.push(rawRef);
      if (raw.code !== 0) throw new Error(`Bilibili followings returned code ${raw.code}: ${raw.message ?? ""}`);
      const rows = raw.data?.list ?? [];
      for (const row of rows) {
        if (!row.mid) continue;
        allUsers.push({
          platform: "bilibili",
          uid: String(row.mid),
          name: row.uname ?? String(row.mid),
          face: row.face,
          sign: row.sign,
          sourceId,
          capturedAt,
          rawRef
        });
      }
      if (!rows.length || rows.length < Math.min(50, limit)) break;
      page += 1;
    }
    const users = allUsers.slice(0, limit);
    return {
      users,
      rawRefs,
      health: [{ sourceId, status: users.length ? "ok" : "empty", checkedAt: capturedAt, provider: "bilibili-web-cookie", itemCount: users.length }]
    };
  } catch (error) {
    return {
      users: [],
      rawRefs,
      health: [
        {
          sourceId,
          status: "error",
          checkedAt: capturedAt,
          provider: "bilibili-web-cookie",
          message: error instanceof Error ? error.message : String(error)
        }
      ]
    };
  }
}
