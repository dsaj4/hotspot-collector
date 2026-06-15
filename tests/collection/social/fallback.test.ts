import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runSocialFallback } from "../../../src/collection/social/fallback.js";

describe("social fallback registry", () => {
  it("returns unavailable health when a registered stream has no fallback", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "social-fallback-"));
    const previous = process.cwd();
    process.chdir(root);
    try {
      const result = await runSocialFallback("xiaohongshu-browser", "home-feed");
      expect(result.health[0].status).toBe("unavailable");
      expect(result.health[0].message).toContain("No fallback is registered");
    } finally {
      process.chdir(previous);
    }
  });

  it("rejects arbitrary source ids and streams", async () => {
    await expect(runSocialFallback("arbitrary-command", "home-feed")).rejects.toThrow("Unknown or disabled browser source");
    await expect(runSocialFallback("weibo-browser", "favorite")).resolves.toMatchObject({ health: [{ status: "unavailable" }] });
  });
});
