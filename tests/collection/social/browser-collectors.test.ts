import { describe, expect, it } from "vitest";
import { buildVisibleSocialExtractionScript } from "../../../src/collection/social/browser-extraction.js";

type FakeElement = {
  innerText?: string;
  textContent?: string;
  href?: string;
  attrs?: Record<string, string>;
  rect?: { width: number; height: number; bottom: number; top: number; right: number; left: number };
};

function fakeDomElement(anchor: FakeElement) {
  return {
    ...anchor,
    parentElement: undefined,
    getAttribute(name: string) {
      if (name === "href") return anchor.href;
      return anchor.attrs?.[name] ?? "";
    },
    getBoundingClientRect() {
      return anchor.rect ?? { width: 100, height: 20, bottom: 120, top: 100, right: 200, left: 10 };
    },
    querySelectorAll() {
      return [];
    }
  };
}

function evaluateExpression(input: { bodyText?: string; anchors: FakeElement[] }): unknown {
  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  const previousWindow = globalThis.window;
  try {
    const elements = input.anchors.map(fakeDomElement);
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        body: { innerText: input.bodyText ?? "" },
        querySelectorAll() {
          return elements;
        }
      }
    });
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { href: "https://www.bilibili.com/v/popular/all/" }
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        innerHeight: 900,
        innerWidth: 1200,
        getComputedStyle() {
          return { visibility: "visible", display: "block" };
        }
      }
    });
    const script = buildVisibleSocialExtractionScript({
      platform: "bilibili",
      streamType: "hotspot",
      sourceId: "bilibili-browser-use-cdp",
      collectionMethod: "browser-use-script",
      limit: 2
    });
    return JSON.parse(eval(script) as string);
  } finally {
    Object.defineProperty(globalThis, "document", { configurable: true, value: previousDocument });
    Object.defineProperty(globalThis, "location", { configurable: true, value: previousLocation });
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }
}

describe("browser social collectors", () => {
  it("extracts visible Bilibili video links with ranks", () => {
    const result = evaluateExpression({
      anchors: [
        { innerText: "First video", href: "/video/BV111" },
        { innerText: "Ignored channel", href: "/read/cv1" },
        { innerText: "Second video", href: "https://www.bilibili.com/video/BV222" },
        { innerText: "Third video", href: "https://www.bilibili.com/video/BV333" }
      ]
    }) as { collectionMethod: string; items: Array<{ title: string; url: string; rank: number }> };

    expect(result.collectionMethod).toBe("browser-use-script");
    expect(result.items).toEqual([
      { title: "First video", url: "https://www.bilibili.com/video/BV111", rank: 1 },
      { title: "Second video", url: "https://www.bilibili.com/video/BV222", rank: 2 }
    ]);
  });

  it("marks hard access boundary pages unavailable", () => {
    const result = evaluateExpression({
      bodyText: "captcha required",
      anchors: [{ innerText: "Hidden video", href: "/video/BV111" }]
    }) as { status: string; message?: string; items: unknown[] };

    expect(result.status).toBe("unavailable");
    expect(result.message).toContain("captcha");
    expect(result.items).toEqual([]);
  });

  it("only treats login prompts as unavailable when no public items are visible", () => {
    const result = evaluateExpression({
      bodyText: "login to continue",
      anchors: []
    }) as { status: string; message?: string; items: unknown[] };

    expect(result.status).toBe("unavailable");
    expect(result.message).toContain("login");
    expect(result.items).toEqual([]);
  });
});
