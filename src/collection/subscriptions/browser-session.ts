import { browserSessionStatus } from "../../core/browser-session.js";
import { nowIso } from "../../core/time.js";
import type { SourceConfig, SourceHealth, SubscriptionItem } from "../../types.js";

export async function collectBrowserSessionSubscription(
  source: SourceConfig,
  rootDir = process.cwd()
): Promise<{ items: SubscriptionItem[]; rawRefs: string[]; health: SourceHealth[] }> {
  const capturedAt = nowIso();
  const provider = "browser-session";
  const status = await browserSessionStatus(source.platform, rootDir);

  if (!status.configured) {
    return {
      items: [],
      rawRefs: [],
      health: [
        {
          sourceId: source.id,
          status: "unavailable",
          checkedAt: capturedAt,
          provider,
          message: `${source.platform} browser session is not configured.`,
          nextAction: `Run npm.cmd run browser:login -- --platform=${source.platform}, then retry this source.`
        }
      ]
    };
  }

  return {
    items: [],
    rawRefs: [],
    health: [
      {
        sourceId: source.id,
        status: "unavailable",
        checkedAt: capturedAt,
        provider,
        message: `${source.platform} browser session exists, but a platform collector has not been enabled yet.`,
        nextAction: "Port and verify the matching Infohub browser collector before enabling this source for content collection."
      }
    ]
  };
}
