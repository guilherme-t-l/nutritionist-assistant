import OpenAI from "openai";
import type { ChatMessage } from "@/lib/prompt";

export interface LLMClient {
  streamChat(
    messages: ChatMessage[],
    options?: { model?: string }
  ): AsyncIterable<string>;
}

class OpenAIClient implements LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(params?: { apiKey?: string; model?: string }) {
    this.client = new OpenAI({ apiKey: params?.apiKey });
    this.model = params?.model ?? "gpt-4o-mini";
  }

  async *streamChat(
    messages: ChatMessage[],
    options?: { model?: string }
  ): AsyncIterable<string> {
    const model = options?.model ?? this.model;
    const response = await this.client.chat.completions.create({
      model,
      messages,
      stream: true,
      temperature: 0.4,
    });

    for await (const chunk of response) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }
}

export function getLLMClient(_provider?: string): LLMClient {
  // Provider switch ready; currently only OpenAI implemented
  return new OpenAIClient({ apiKey: process.env.OPENAI_API_KEY });
}

