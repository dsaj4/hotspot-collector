import { describe, expect, it } from "vitest";
import { parseCsvEnv, parseIntegerEnv, parseUsernameCsvEnv } from "../../src/core/env.js";

describe("environment parsing", () => {
  it("uses bounded integer fallbacks", () => {
    expect(parseIntegerEnv(undefined, 20, { min: 1, max: 100 })).toBe(20);
    expect(parseIntegerEnv("0", 20, { min: 1, max: 100 })).toBe(1);
    expect(parseIntegerEnv("999", 20, { min: 1, max: 100 })).toBe(100);
    expect(parseIntegerEnv("oops", 20, { min: 1, max: 100 })).toBe(20);
  });

  it("parses csv values and strips empty items", () => {
    expect(parseCsvEnv(" all, MP_1, , MP_2 ")).toEqual(["all", "MP_1", "MP_2"]);
    expect(parseCsvEnv(undefined, "all")).toEqual(["all"]);
  });

  it("normalizes X usernames", () => {
    expect(parseUsernameCsvEnv("@alice, bob")).toEqual(["alice", "bob"]);
  });
});
