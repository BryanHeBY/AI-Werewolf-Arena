import OpenAI from "openai";
import { withRetry } from "./retry";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenAIClientOptions {
  apiKey: string;
  baseURL?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * OpenAI SDK 适配器：
 * 对外暴露最小 chat 能力，并统一接入重试策略。
 */
export class OpenAIClient {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxTokens: number;

  constructor(options: OpenAIClientOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
    });
    this.model = options.model;
    this.temperature = options.temperature ?? 0.7;
    this.maxTokens = options.maxTokens ?? 1024;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const completion = await withRetry(async () => {
      return await this.client.chat.completions.create({
        model: this.model,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        messages,
      });
    });

    return completion.choices[0]?.message?.content ?? "";
  }
}
