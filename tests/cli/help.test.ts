import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("CLI help", () => {
  it("prints official-account help without running collection", () => {
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    const output = execSync(`${npmCommand} run collect:official-accounts -- --help`, {
      cwd: process.cwd(),
      encoding: "utf-8"
    });

    expect(output).toContain("Usage: npm.cmd run collect:official-accounts");
    expect(output).toContain("Collect official-account subscriptions");
    expect(output).not.toContain('"health"');
    expect(output).not.toContain('"subscriptionCount"');
  });
});
