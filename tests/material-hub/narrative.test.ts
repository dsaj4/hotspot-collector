import { describe, expect, it } from "vitest";
import { assignNarrativeLines, narrativeLines } from "../../src/material-hub/narrative.js";

describe("narrative assignment", () => {
  it("returns known narrative line IDs", () => {
    const known = new Set(narrativeLines.map((line) => line.id));
    const assigned = assignNarrativeLines({
      title: "AI agent workflow needs review boundaries",
      summary: "source tracing and human judgment",
      platform: "github"
    });

    expect(assigned.length).toBeGreaterThan(0);
    expect(assigned.every((id) => known.has(id))).toBe(true);
  });
});
