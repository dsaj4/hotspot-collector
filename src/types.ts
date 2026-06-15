export type SourceKind = "subscription" | "hotspot";

export type SourceStatus = "ok" | "cache" | "empty" | "error" | "unavailable";

export type SourceFetchMode = "public-api" | "direct-rss" | "rsshub" | "cookie-http" | "browser-session";
export type SocialStreamType = "subscription" | "search" | "favorite" | "hotspot" | "home-feed";
export type SocialFallbackAdapter = "bilibili-subscriptions" | "bilibili-hotspots" | "weibo-hotspots" | "rsshub-subscription";

export type SourceConfig = {
  id: string;
  kind: SourceKind;
  platform: string;
  name: string;
  enabled: boolean;
  intervalMinutes: number;
  fetchMode: SourceFetchMode;
  params?: Record<string, string | number | boolean>;
  browser?: {
    streams: SocialStreamType[];
    fallbackByStream?: Partial<Record<SocialStreamType, SocialFallbackAdapter>>;
  };
  policy: {
    requiresLogin: boolean;
    usesCookie: boolean;
    usesBrowserSession: boolean;
    publicOnly: boolean;
    enabledByDefault: boolean;
  };
};

export type SourceHealth = {
  sourceId: string;
  status: SourceStatus;
  checkedAt: string;
  provider?: string;
  itemCount?: number;
  message?: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  nextAction?: string;
  successWindowHours?: number;
  meetsSuccessSla?: boolean;
};

export type SocialItem = {
  id: string;
  sourceId: string;
  platform: string;
  provider: "browser-use";
  streamType: SocialStreamType;
  title: string;
  url: string;
  authorId?: string;
  authorName?: string;
  publishedAt: string | null;
  capturedAt: string;
  body: string;
  media: string[];
  rank?: number;
  heat?: number | string;
  rawRef: string;
  dedupeKey: string;
};

export type BrowserObservationItem = {
  externalId?: string;
  title: string;
  url: string;
  authorId?: string;
  authorName?: string;
  publishedAt?: string | null;
  body?: string;
  media?: string[];
  rank?: number;
  heat?: number | string;
};

export type BrowserObservation = {
  sourceId: string;
  platform: "bilibili" | "weibo" | "xiaohongshu" | "wechat";
  streamType: SocialStreamType;
  pageUrl: string;
  status: "ok" | "empty" | "error" | "unavailable";
  capturedAt?: string;
  message?: string;
  items: BrowserObservationItem[];
};

export type SubscriptionItem = {
  id: string;
  sourceId: string;
  platform: string;
  provider: string;
  authorId: string;
  authorName: string;
  title: string;
  url: string;
  publishedAt: string | null;
  capturedAt: string;
  summary: string;
  media: string[];
  rawRef: string;
  dedupeKey: string;
};

export type FollowedUser = {
  platform: "bilibili" | "x";
  uid: string;
  name: string;
  username?: string;
  face?: string;
  sign?: string;
  sourceId: string;
  capturedAt: string;
  rawRef: string;
};

export type HotspotItem = {
  id: string;
  sourceId: string;
  platform: string;
  provider: string;
  rank: number;
  title: string;
  url: string;
  mobileUrl?: string;
  heat?: number | string;
  label?: string;
  category: string;
  capturedAt: string;
  rawRef: string;
  dedupeKey: string;
};

export type TranscriptSegment = {
  start: string;
  end: string;
  text: string;
};

export type VideoTranscriptItem = {
  id: string;
  sourceId: string;
  platform: "bilibili";
  provider: string;
  videoId: string;
  title: string;
  url: string;
  language: string;
  transcriptKind: "ai-subtitle" | "platform-subtitle";
  capturedAt: string;
  text: string;
  segments: TranscriptSegment[];
  rawRef: string;
  dedupeKey: string;
};

export type CollectionResult = {
  rawRefs: string[];
  normalizedRefs: string[];
  health: SourceHealth[];
  subscriptionCount?: number;
  hotspotCount?: number;
  transcriptCount?: number;
  aiTranscriptCount?: number;
};

export type CandidateAsset = {
  candidateId: string;
  title: string;
  sourceItems: HotspotItem[];
  captureWindow: string;
  evidenceLevel: "L0 raw" | "L1 visible-source" | "L2 cross-checked" | "L3 publication-ready";
  riskLevel: "low" | "medium" | "high";
  riskNotes: string[];
  visionTreeAngle: string;
  recommendedAccounts: string[];
  contentSystemMapping: {
    id: string;
    title: string;
    theme: string;
    source: string;
    format: string;
    freshness: string;
    score: number;
    tags: string[];
    summary: string;
    owner: string;
    palette: string;
    notes: string[];
    resources: Array<{
      id: string;
      title: string;
      kind: "web" | "pdf";
      url: string;
      source: string;
      updated: string;
      summary: string;
      highlights: string[];
    }>;
  };
  syncStatus: "not-ready" | "ready-for-prep" | "ready-for-content-system" | "synced" | "rejected";
};
