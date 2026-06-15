import { describe, expect, it } from "vitest";
import { collectBrowserSessionSubscription } from "../../../src/collection/subscriptions/browser-session.js";
import type { SourceConfig } from "../../../src/types.js";

describe("browser-session subscription adapter", () => {
  it("returns actionable unavailable health when no session exists", async () => {
    const source: SourceConfig = {
      id: "x-browser-openai",
      kind: "subscription",
      platform: "x",
      name: "X @openai",
      enabled: true,
      intervalMinutes: 60,
      fetchMode: "browser-session",
      params: { platformId: "openai" },
      policy: {
        requiresLogin: true,
        usesCookie: false,
        usesBrowserSession: true,
        publicOnly: false,
        enabledByDefault: false
      }
    };

    const result = await collectBrowserSessionSubscription(source, "data/test-browser-adapter-empty");
    expect(result.items).toEqual([]);
    expect(result.health[0].status).toBe("unavailable");
    expect(result.health[0].nextAction).toContain("browser:login");
  });
});
