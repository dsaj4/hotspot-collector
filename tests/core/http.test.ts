import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson, fetchText } from "../../src/core/http.js";

function mockResponse(input: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Server Error",
    json: vi.fn().mockResolvedValue(input),
    text: vi.fn().mockResolvedValue(String(input))
  } as unknown as Response;
}

describe("http helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches json with default browser-like headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse({ ok: true }));
    await expect(fetchJson("https://example.com/api")).resolves.toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect((init?.headers as Record<string, string>).Accept).toContain("application/json");
    expect((init?.headers as Record<string, string>)["User-Agent"]).toContain("Mozilla");
  });

  it("fetches text and reports http errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse("hello"));
    await expect(fetchText("https://example.com/rss")).resolves.toBe("hello");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse("broken", false));
    await expect(fetchText("https://example.com/rss")).rejects.toThrow("HTTP 500");
  });
});
