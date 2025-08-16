import OpenAI from "openai";
import type { GenerateOptions, LLMClient } from "./types";
import { BaseMessage, buildMessagesWithContext } from "./systemPrompt";
import { sessionManager } from "./sessionManager";

export class OpenAILLMClient implements LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(params?: { apiKey?: string; model?: string }) {
    this.client = new OpenAI({ apiKey: params?.apiKey || process.env.OPENAI_API_KEY });
    this.model = params?.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
  }

  async *generateStream(options: GenerateOptions): AsyncIterable<string> {
    const { messages, preferences, planDoc, temperature = 0.4, maxTokens = 2000, sessionId } = options;
    
    // Get conversation summary if session exists
    let conversationSummary: string | undefined;
    if (sessionId) {
      const context = sessionManager.getContext(sessionId);
      conversationSummary = context?.contextSummary;
    }
    
    // Convert messages to base format for context building
    const baseMessages: BaseMessage[] = messages.map((m) => ({ 
      role: m.role as "user" | "assistant" | "system", 
      content: m.content 
    }));
    
    const openaiMessages = buildMessagesWithContext(baseMessages, preferences, planDoc, conversationSummary);

    const resp = await this.client.chat.completions.create({
      model: this.model,
      stream: true,
      temperature,
      max_tokens: maxTokens,
      top_p: 0.9, // Add top_p for better response quality
      messages: openaiMessages,
    });

    for await (const chunk of resp) {
      const delta = chunk.choices?.[0]?.delta?.content as string | undefined;
      if (delta) yield delta;
    }
  }
}

