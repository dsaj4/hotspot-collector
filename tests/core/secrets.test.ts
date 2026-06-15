import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { deleteSecret, saveSecret, secretStatuses } from "../../src/core/secrets.js";

let roots: string[] = [];

function testRoot(): string {
  const root = mkdtempSync(path.join(process.cwd(), "data", "test-secrets-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots = [];
});

describe("local secret store", () => {
  it("stores status without exposing secret values", async () => {
    const root = testRoot();
    const status = await saveSecret({ platform: "bilibili", type: "cookie", value: "SESSDATA=secret" }, root);

    expect(status.platform).toBe("bilibili");
    expect(status.configured).toBe(true);
    expect(JSON.stringify(status)).not.toContain("SESSDATA");
    expect((await secretStatuses(root))).toHaveLength(1);
  });

  it("deletes stored secrets", async () => {
    const root = testRoot();
    await saveSecret({ platform: "weibo", type: "cookie", value: "SUB=secret" }, root);

    await expect(deleteSecret("weibo", root)).resolves.toEqual({ deleted: true });
    await expect(secretStatuses(root)).resolves.toEqual([]);
  });
});
