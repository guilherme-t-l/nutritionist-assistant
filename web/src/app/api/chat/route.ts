import { NextRequest } from "next/server";
import { OpenAILLMClient } from "@/lib/llm/openaiClient";
import type { ChatMessage, Preferences } from "@/lib/llm/types";

export const runtime = "nodejs";

interface IncomingBody {
  messages: { role: ChatMessage["role"]; content: string }[];
  preferences?: Preferences;
  planDoc?: string;
}

// Logging utility for request analytics
const logRequest = (data: {
  requestId: string;
  phase: 'start' | 'end' | 'error';
  provider?: string;
  messageCount?: number;
  duration?: number;
  error?: string;
  preferences?: Preferences;
  planDocLength?: number;
}) => {
  const timestamp = new Date().toISOString();
  console.log(`[CHAT-API] ${timestamp} [${data.requestId}] ${data.phase.toUpperCase()}:`, {
    ...data,
    timestamp
  });
};

function validateBody(body: unknown): { messages: ChatMessage[]; preferences?: Preferences; planDoc?: string } {
  if (!body || typeof body !== "object") throw new Error("Invalid body");
  const b = body as Partial<IncomingBody>;
  if (!Array.isArray(b.messages)) throw new Error("Missing messages");
  const messages: ChatMessage[] = b.messages.map((m) => ({
    role: m!.role,
    content: String(m!.content ?? ""),
  }));
  const preferences: Preferences | undefined = b.preferences;
  const planDoc: string | undefined = typeof b.planDoc === "string" ? b.planDoc : undefined;
  return { messages, preferences, planDoc };
}

export async function POST(req: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const startTime = Date.now();
  
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") || "openai";

  let messages: ChatMessage[] = [];
  let preferences: Preferences | undefined;
  let planDoc: string | undefined;
  
  // Log request start
  logRequest({
    requestId,
    phase: 'start',
    provider,
  });
  
  try {
    const json = await req.json();
    const v = validateBody(json);
    messages = v.messages;
    preferences = v.preferences;
    planDoc = v.planDoc;
    
    // Log request details
    logRequest({
      requestId,
      phase: 'start',
      provider,
      messageCount: messages.length,
      preferences,
      planDocLength: planDoc?.length || 0,
    });
    
  } catch (err) {
    const duration = Date.now() - startTime;
    logRequest({
      requestId,
      phase: 'error',
      duration,
      error: `Validation error: ${(err as Error).message}`,
    });
    
    return new Response(JSON.stringify({ error: String((err as Error).message) }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (provider !== "openai") {
    const duration = Date.now() - startTime;
    logRequest({
      requestId,
      phase: 'error',
      duration,
      error: `Unsupported provider: ${provider}`,
    });
    
    return new Response(JSON.stringify({ error: "Only OpenAI is supported server-side. Use WebLLM client for local." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const client = new OpenAILLMClient();
  let totalTokensStreamed = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of client.generateStream({ messages, preferences, planDoc })) {
          // Estimate token count (rough approximation: ~4 chars per token)
          totalTokensStreamed += Math.ceil(chunk.length / 4);
          controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        
        const duration = Date.now() - startTime;
        logRequest({
          requestId,
          phase: 'end',
          provider,
          duration,
          messageCount: messages.length,
          preferences,
          planDocLength: planDoc?.length || 0,
        });
        
        // Log streaming stats
        console.log(`[CHAT-API] ${new Date().toISOString()} [${requestId}] STREAMING_STATS:`, {
          totalTokensStreamed,
          avgTokensPerSecond: Math.round(totalTokensStreamed / (duration / 1000)),
          duration,
          requestId
        });
        
        controller.close();
      } catch (err) {
        const duration = Date.now() - startTime;
        logRequest({
          requestId,
          phase: 'error',
          duration,
          error: `Stream error: ${(err as Error).message}`,
        });
        
        controller.enqueue(encoder.encode(`event: error\n` + `data: ${String((err as Error).message)}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

