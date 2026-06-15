import { describe, expect, it } from "vitest";
import { detectSource } from "../../src/sources/detect.js";

describe("source detection", () => {
  it("detects Bilibili user space URLs", () => {
    const result = detectSource("https://space.bilibili.com/289842886");
    expect(result.platform).toBe("bilibili");
    expect(result.platformId).toBe("289842886");
    expect(result.source.fetchMode).toBe("public-api");
  });

  it("detects X URLs as browser-session templates, not official API", () => {
    const result = detectSource("https://x.com/openai");
    expect(result.platform).toBe("x");
    expect(result.platformId).toBe("openai");
    expect(result.source.fetchMode).toBe("browser-session");
    expect(result.source.policy.usesBrowserSession).toBe(true);
  });

  it("detects Zhihu people URLs as RSSHub templates", () => {
    const result = detectSource("https://www.zhihu.com/people/example-id");
    expect(result.platform).toBe("zhihu");
    expect(result.platformId).toBe("example-id");
    expect(result.source.fetchMode).toBe("rsshub");
  });

  it("detects generic feed URLs", () => {
    const result = detectSource("https://example.com/feed.xml");
    expect(result.platform).toBe("rss");
    expect(result.source.fetchMode).toBe("direct-rss");
  });
});
