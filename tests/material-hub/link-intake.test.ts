import { describe, expect, it } from "vitest";
import { buildTemporaryLinkSourceItem } from "../../src/material-hub/link-intake.js";

describe("temporary link intake", () => {
  it("detects platform and builds a traceable temporary source item", () => {
    const item = buildTemporaryLinkSourceItem("https://space.bilibili.com/289842886", "2026-06-08T00:00:00.000Z");

    expect(item.sourceKind).toBe("temporary-link");
    expect(item.platform).toBe("bilibili");
    expect(item.provider).toBe("public-api");
    expect(item.url).toBe("https://space.bilibili.com/289842886");
    expect(item.dedupeKey).toMatch(/^temporary-link:/);
    expect(item.capturedAt).toBe("2026-06-08T00:00:00.000Z");
  });
});
