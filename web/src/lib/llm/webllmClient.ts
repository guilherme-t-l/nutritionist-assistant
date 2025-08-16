"use client";

import { CreateMLCEngine, MLCEngineInterface, ChatCompletionChunk } from "@mlc-ai/web-llm";
import type { GenerateOptions, LLMClient } from "./types";
import { BaseMessage, buildMessagesWithContext } from "./systemPrompt";
import { sessionManager } from "./sessionManager";

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

    const { messages, preferences, planDoc, temperature = 0.4, maxTokens = 2000, sessionId } = options;
    
    // Get conversation summary if session exists (WebLLM runs client-side, so session might not be available)
    let conversationSummary: string | undefined;
    if (sessionId && typeof window !== "undefined") {
      // For client-side session management, we'd need a different approach
      // For now, we'll skip the summary for WebLLM
      conversationSummary = undefined;
    }
    
    // Convert messages to base format for context building
    const baseMessages: BaseMessage[] = messages.map((m) => ({ 
      role: m.role as "user" | "assistant" | "system", 
      content: m.content 
    }));
    
    const mlcMessages = buildMessagesWithContext(baseMessages, preferences, planDoc, conversationSummary);

    const stream = await this.engine.chat.completions.create({
      // web-llm types are permissive; messages match its expected shape
      messages: mlcMessages as unknown as Array<{ role: "system" | "user" | "assistant"; content: string }>,
      stream: true,
      temperature,
      max_tokens: maxTokens,
      top_p: 0.9, // Add top_p for better response quality
    });

    for await (const chunk of stream as AsyncIterable<ChatCompletionChunk>) {
      const delta: string = chunk.choices?.[0]?.delta?.content ?? "";
      if (delta) yield delta;
    }
  }
}

