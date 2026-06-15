import { deepseekApiKey, deepseekBaseUrl, deepseekModel } from "../config.js";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type DeepSeekClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

export type DeepSeekChatResult = {
  model: string;
  content: string;
  usage?: unknown;
};

type DeepSeekChatResponse = {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: unknown;
};

export class DeepSeekClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: DeepSeekClientOptions = {}) {
    this.apiKey = options.apiKey ?? deepseekApiKey;
    this.baseUrl = (options.baseUrl ?? deepseekBaseUrl).replace(/\/+$/, "");
    this.model = options.model ?? deepseekModel;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async chat(messages: ChatMessage[], options: { temperature?: number; maxTokens?: number } = {}): Promise<DeepSeekChatResult> {
    if (!this.apiKey) {
      throw new Error("DEEPSEEK_API_KEY is required for LLM material generation. Load it from KeePassXC or set it in the process environment.");
    }
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        thinking: { type: "disabled" },
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 1800,
        response_format: { type: "json_object" }
      })
    });

    const bodyText = await response.text();
    let parsed: DeepSeekChatResponse;
    try {
      parsed = JSON.parse(bodyText) as DeepSeekChatResponse;
    } catch {
      throw new Error(`DeepSeek returned non-JSON response: ${bodyText.slice(0, 200)}`);
    }

    if (!response.ok) {
      throw new Error(`DeepSeek API error ${response.status}: ${JSON.stringify(parsed).slice(0, 300)}`);
    }

    const content = parsed.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek response did not include choices[0].message.content.");

    return {
      model: parsed.model ?? this.model,
      content,
      usage: parsed.usage
    };
  }
}

export function parseJsonObjectFromText(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]?.trim();
  const candidate = fenced ?? trimmed;
  return JSON.parse(candidate) as Record<string, unknown>;
}
