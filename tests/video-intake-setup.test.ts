import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { setupBiliSum } from "../src/video-intake/setup.js";

describe("BiliSum automatic setup", () => {
  it("writes stable local connection config without starting when requested", async () => {
    const root = path.join(tmpdir(), `hotspot-bilisum-setup-${Date.now()}`);
    const projectRoot = path.join(root, "BiliSum");
    await mkdir(path.join(projectRoot, "apps", "service", "src", "video_sum_service"), { recursive: true });
    await writeFile(path.join(projectRoot, "pyproject.toml"), "[project]\nname='bilisum-test'\n", "utf8");
    await writeFile(path.join(projectRoot, "apps", "service", "src", "video_sum_service", "main.py"), "", "utf8");
    const previous = process.cwd();
    process.chdir(root);
    try {
      const result = await setupBiliSum({ projectRoot, baseUrl: "http://127.0.0.1:43839", start: false });
      expect(result.configured).toBe(true);
      expect(result.serviceStatus).toBe("unavailable");
      expect(result.accessTokenConfigured).toBe(true);

      const config = JSON.parse(await readFile(path.join(root, "data", "secrets", "bilisum.json"), "utf8"));
      expect(config.projectRoot).toBe(projectRoot);
      expect(config.accessToken.length).toBeGreaterThan(20);
      expect(await readFile(path.join(projectRoot, ".env.hotspot-collector"), "utf8")).toContain("VIDEO_SUM_ACCESS_TOKEN=");
    } finally {
      process.chdir(previous);
    }
  });
});
