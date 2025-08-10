import OpenAI from "openai";
import type { GenerateOptions, LLMClient } from "./types";
import { BaseMessage, buildMessagesWithContext } from "./systemPrompt";

export class OpenAILLMClient implements LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(params?: { apiKey?: string; model?: string }) {
    this.client = new OpenAI({ apiKey: params?.apiKey || process.env.OPENAI_API_KEY });
    this.model = params?.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
  }

  async *generateStream(options: GenerateOptions): AsyncIterable<string> {
    const { messages, preferences, planDoc, temperature = 0.7, maxTokens = 512 } = options;
    const filtered: BaseMessage[] = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    const openaiMessages = buildMessagesWithContext(filtered, preferences, planDoc);

    const resp = await this.client.chat.completions.create({
      model: this.model,
      stream: true,
      temperature,
      max_tokens: maxTokens,
      messages: openaiMessages,
    });

    for await (const chunk of resp) {
      const delta = chunk.choices?.[0]?.delta?.content as string | undefined;
      if (delta) yield delta;
    }
  }
}

