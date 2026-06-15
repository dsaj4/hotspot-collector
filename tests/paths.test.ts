import path from "node:path";
import { describe, expect, it } from "vitest";
import { artifactPath, dataRoot, externalRoot, recommendedDataRoot, recommendedExternalRoot } from "../src/core/paths.js";

describe("runtime path roots", () => {
  it("uses the recommended external roots for the default workspace", () => {
    expect(dataRoot("E:/Project/hotspot-collector").replaceAll("\\", "/")).toBe(recommendedDataRoot);
    expect(externalRoot("E:/Project/hotspot-collector").replaceAll("\\", "/")).toBe(recommendedExternalRoot);
  });

  it("keeps temporary workspaces self-contained by default", () => {
    expect(dataRoot("E:/tmp/hotspot-test").replaceAll("\\", "/")).toBe("E:/tmp/hotspot-test/data");
    expect(externalRoot("E:/tmp/hotspot-test").replaceAll("\\", "/")).toBe("E:/tmp/hotspot-test/external");
  });

  it("maps stable artifact refs to the configured data root", () => {
    const previous = process.env.HOTSPOT_DATA_ROOT;
    process.env.HOTSPOT_DATA_ROOT = "E:/custom-hotspot-data";
    try {
      expect(artifactPath("data/raw/example.json").replaceAll("\\", "/")).toBe("E:/custom-hotspot-data/raw/example.json");
      expect(artifactPath("reports/feeds/hotspots.json").replaceAll("\\", "/")).toBe("E:/custom-hotspot-data/reports/feeds/hotspots.json");
    } finally {
      if (previous === undefined) delete process.env.HOTSPOT_DATA_ROOT;
      else process.env.HOTSPOT_DATA_ROOT = previous;
    }
  });

  it("resolves non-artifact paths normally", () => {
    expect(artifactPath("fixtures/raw/sample.json")).toBe(path.resolve("fixtures/raw/sample.json"));
  });
});
