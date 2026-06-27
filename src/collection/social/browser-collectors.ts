import type { BrowserObservation, SocialStreamType } from "../../types.js";
import { cdpCommand, cdpEvaluate } from "../../core/cdp.js";
import { buildVisibleSocialExtractionScript } from "./browser-extraction.js";

type CdpTarget = {
  type?: string;
  url?: string;
  title?: string;
  webSocketDebuggerUrl?: string;
};

type CollectInput = {
  platform: BrowserObservation["platform"];
  streamType: SocialStreamType;
  sourceId?: string;
  pageUrl: string;
  port?: number;
  limit?: number;
};

function urlNeedle(pageUrl: string): string {
  try {
    const parsed = new URL(pageUrl);
    return `${parsed.host}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return pageUrl;
  }
}

async function listTargets(port: number): Promise<CdpTarget[]> {
  return fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json()) as Promise<CdpTarget[]>;
}

async function waitForPage(port: number, pageUrl: string): Promise<string | null> {
  const needle = urlNeedle(pageUrl);
  for (let index = 0; index < 20; index += 1) {
    const targets = await listTargets(port);
    const matched = targets.find((target) =>
      target.type === "page" &&
      target.webSocketDebuggerUrl &&
      target.url?.includes(needle)
    );
    if (matched?.webSocketDebuggerUrl) return matched.webSocketDebuggerUrl;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

async function findOrOpenPage(port: number, pageUrl: string): Promise<string | null> {
  const existing = await waitForPage(port, pageUrl);
  if (existing) return existing;

  const targets = await listTargets(port);
  const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
  if (!page?.webSocketDebuggerUrl) return null;

  await cdpCommand(page.webSocketDebuggerUrl, "Page.navigate", { url: pageUrl });
  return waitForPage(port, pageUrl);
}

export async function collectBrowserObservationViaCdp(input: CollectInput): Promise<BrowserObservation> {
  const port = input.port ?? 9223;
  const sourceId = input.sourceId ?? `${input.platform}-direct-cdp`;
  const capturedAt = new Date().toISOString();

  const webSocketUrl = await findOrOpenPage(port, input.pageUrl);
  if (!webSocketUrl) {
    return {
      sourceId,
      platform: input.platform,
      streamType: input.streamType,
      collectionMethod: "direct-cdp",
      pageUrl: input.pageUrl,
      status: "unavailable",
      capturedAt,
      message: `No CDP page target was available on port ${port}.`,
      items: []
    };
  }

  const extractionJson = await cdpEvaluate<string>(
    webSocketUrl,
    buildVisibleSocialExtractionScript({
      platform: input.platform,
      streamType: input.streamType,
      sourceId,
      collectionMethod: "direct-cdp",
      limit: input.limit
    })
  );
  const observation = JSON.parse(extractionJson) as BrowserObservation;

  return {
    ...observation,
    sourceId: observation.sourceId || sourceId,
    platform: observation.platform || input.platform,
    streamType: observation.streamType || input.streamType,
    collectionMethod: "direct-cdp",
    pageUrl: observation.pageUrl || input.pageUrl,
    capturedAt,
    items: observation.items ?? []
  };
}
