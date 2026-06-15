import { describe, expect, it } from "vitest";
import { buildRsshubUrl } from "../src/sources/rsshub.js";
import type { SourceConfig } from "../src/types.js";

function source(platform: string, platformId: string): SourceConfig {
  return {
    id: `${platform}-${platformId}`,
    kind: "subscription",
    platform,
    name: `${platform} ${platformId}`,
    enabled: true,
    intervalMinutes: 60,
    fetchMode: "rsshub",
    params: { platformId },
    policy: {
      requiresLogin: false,
      usesCookie: false,
      usesBrowserSession: false,
      publicOnly: false,
      enabledByDefault: false
    }
  };
}

describe("RSSHub route builder", () => {
  it("builds Infohub-compatible X user routes without official API fields", () => {
    expect(buildRsshubUrl(source("x", "openai"), "http://localhost:1200")).toBe("http://localhost:1200/twitter/user/openai");
  });

  it("builds Weibo and Zhihu routes", () => {
    expect(buildRsshubUrl(source("weibo", "123456"), "http://localhost:1200/")).toBe("http://localhost:1200/weibo/user/123456");
    expect(buildRsshubUrl(source("zhihu", "alice"), "http://localhost:1200")).toBe("http://localhost:1200/zhihu/people/activities/alice");
  });

  it("requires a base URL", () => {
    expect(() => buildRsshubUrl(source("x", "openai"), "")).toThrow("RSSHUB_BASE_URL");
  });
});
