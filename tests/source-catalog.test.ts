import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultSources, enabledSources, loadSourceCatalog } from "../src/sources/catalog.js";

describe("source catalog", () => {
  it("falls back to built-in sources when no catalog file exists", () => {
    const sources = loadSourceCatalog(path.join(tmpdir(), "missing-hotspot-sources.json"));
    expect(sources.length).toBe(defaultSources().length);
    expect(sources.some((source) => source.id === "x-recent-search")).toBe(false);
  });

  it("loads a file catalog when present", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "hotspot-sources-"));
    const file = path.join(dir, "sources.json");
    writeFileSync(
      file,
      JSON.stringify({
        sources: [
          {
            id: "rss-example",
            kind: "subscription",
            platform: "rss",
            name: "RSS Example",
            enabled: true,
            intervalMinutes: 60,
            fetchMode: "direct-rss",
            policy: {
              requiresLogin: false,
              usesCookie: false,
              usesBrowserSession: false,
              publicOnly: true,
              enabledByDefault: true
            }
          }
        ]
      }),
      "utf8"
    );

    const sources = loadSourceCatalog(file);
    expect(sources.map((source) => source.id)).toEqual(["rss-example"]);
    expect(enabledSources(sources).length).toBe(1);
  });
});
