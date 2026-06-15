import { describe, expect, it } from "vitest";
import { materialHubConfigStatus } from "../../src/material-hub/config-status.js";

describe("material hub config status", () => {
  it("reports presence flags without secret values", () => {
    const status = materialHubConfigStatus();
    const serialized = JSON.stringify(status);

    expect(status.deepseek.baseUrl).toContain("api.deepseek.com");
    expect(typeof status.deepseek.apiKeyPresent).toBe("boolean");
    expect(typeof status.ima.apiKeyPresent).toBe("boolean");
    expect(serialized).not.toContain(process.env.DEEPSEEK_API_KEY ?? "value-that-will-not-match");
    expect(serialized).not.toContain(process.env.IMA_OPENAPI_APIKEY ?? "value-that-will-not-match");
  });
});
