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
  forceJsonResponse?: boolean;
}

export interface ChatOptions {
  signal?: AbortSignal;
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
  private readonly forceJsonResponse: boolean;

  constructor(options: OpenAIClientOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
    });
    this.model = options.model;
    this.temperature = options.temperature ?? 0.7;
    this.maxTokens = options.maxTokens ?? 1024;
    this.forceJsonResponse = options.forceJsonResponse ?? true;
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    try {
      const completion = await this.createCompletion(
        messages,
        options.signal,
        this.forceJsonResponse,
      );
      return completion.choices[0]?.message?.content ?? "";
    } catch (error) {
      if (
        this.forceJsonResponse &&
        this.isResponseFormatUnsupported(error)
      ) {
        const completion = await this.createCompletion(messages, options.signal, false);
        return completion.choices[0]?.message?.content ?? "";
      }
      throw error;
    }
  }

  private async createCompletion(
    messages: ChatMessage[],
    signal: AbortSignal | undefined,
    forceJsonResponse: boolean,
  ) {
    return withRetry(async () => {
      const payload: any = {
        model: this.model,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        messages,
      };
      if (forceJsonResponse) {
        payload.response_format = { type: "json_object" };
      }

      return this.client.chat.completions.create(payload, { signal });
    });
  }

  private isResponseFormatUnsupported(error: unknown): boolean {
    const text = String(error).toLowerCase();
    return (
      text.includes("response_format") &&
      (text.includes("unsupported") ||
        text.includes("unknown") ||
        text.includes("not support") ||
        text.includes("invalid"))
    );
  }
}
