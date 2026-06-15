import { describe, expect, it } from "vitest";
import { DeepSeekClient, parseJsonObjectFromText } from "../../src/material-hub/deepseek-client.js";

describe("DeepSeek client", () => {
  it("parses plain and fenced JSON objects", () => {
    expect(parseJsonObjectFromText('{"ok":true}')).toEqual({ ok: true });
    expect(parseJsonObjectFromText("```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
  });

  it("sends chat completion requests without exposing the key in results", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      requests.push({ url: String(url), init: init ?? {} });
      return new Response(
        JSON.stringify({
          model: "deepseek-test",
          choices: [{ message: { content: "{\"topic\":\"source-backed\"}" } }],
          usage: { total_tokens: 12 }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const client = new DeepSeekClient({
      apiKey: "test-api-key",
      baseUrl: "https://api.deepseek.test/",
      model: "deepseek-test",
      fetchImpl: fetchImpl as typeof fetch
    });
    const result = await client.chat([{ role: "user", content: "Analyze" }]);

    expect(result).toEqual({
      model: "deepseek-test",
      content: "{\"topic\":\"source-backed\"}",
      usage: { total_tokens: 12 }
    });
    expect(requests[0]?.url).toBe("https://api.deepseek.test/chat/completions");
    expect(requests[0]?.init.headers).toMatchObject({ Authorization: "Bearer test-api-key" });
    expect(JSON.stringify(result)).not.toContain("test-api-key");
  });
});
