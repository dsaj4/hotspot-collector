import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { browserSessionStatus, clearBrowserSession } from "../src/core/browser-session.js";

let roots: string[] = [];

function testRoot(): string {
  const root = mkdtempSync(path.join(process.cwd(), "data", "test-browser-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots = [];
});

describe("browser session metadata", () => {
  it("reports missing sessions without launching a browser", async () => {
    const root = testRoot();
    const status = await browserSessionStatus("weibo", root);

    expect(status.platform).toBe("weibo");
    expect(status.configured).toBe(false);
    expect(status.profileDir).toContain("data");
  });

  it("clears absent sessions safely", async () => {
    const root = testRoot();
    await expect(clearBrowserSession("weibo", root)).resolves.toEqual({ cleared: false });
  });
});
