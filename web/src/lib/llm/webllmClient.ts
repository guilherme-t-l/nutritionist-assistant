"use client";

import { CreateMLCEngine, MLCEngineInterface, ChatCompletionChunk } from "@mlc-ai/web-llm";
import type { GenerateOptions, LLMClient } from "./types";
import { BaseMessage, buildMessagesWithContext } from "./systemPrompt";

export class WebLLMClient implements LLMClient {
  private engine: MLCEngineInterface | null = null;
  private modelId: string;

  constructor(modelId: string = "Llama-3.2-1B-Instruct-q4f32_1-MLC") {
    this.modelId = modelId;
  }

  private async ensureEngine(): Promise<void> {
    if (this.engine) return;
    this.engine = await CreateMLCEngine(this.modelId, {});
  }

  async *generateStream(options: GenerateOptions): AsyncIterable<string> {
    await this.ensureEngine();
    if (!this.engine) throw new Error("WebLLM engine not initialized");

    const { messages, preferences, planDoc, temperature = 0.7, maxTokens = 512 } = options;
    const filtered: BaseMessage[] = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    const mlcMessages = buildMessagesWithContext(filtered, preferences, planDoc);

    const stream = await this.engine.chat.completions.create({
      // web-llm types are permissive; messages match its expected shape
      messages: mlcMessages as unknown as Array<{ role: "system" | "user" | "assistant"; content: string }>,
      stream: true,
      temperature,
      max_tokens: maxTokens,
    });

    for await (const chunk of stream as AsyncIterable<ChatCompletionChunk>) {
      const delta: string = chunk.choices?.[0]?.delta?.content ?? "";
      if (delta) yield delta;
    }
  }
}

