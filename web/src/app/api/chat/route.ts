import { NextRequest } from "next/server";
import { OpenAILLMClient } from "@/lib/llm/openaiClient";
import type { ChatMessage, Preferences } from "@/lib/llm/types";
import { sessionManager } from "@/lib/llm/sessionManager";
import { getQualityMetricsService } from "@/lib/llm/qualityMetrics";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

interface IncomingBody {
  messages: { role: ChatMessage["role"]; content: string }[];
  preferences?: Preferences;
  planDoc?: string;
  sessionId?: string;
}

// Simple metrics logging
interface RequestMetrics {
  timestamp: string;
  provider: string;
  messageCount: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
}

function logMetrics(metrics: RequestMetrics) {
  const logData = {
    ...metrics,
    duration: metrics.endTime ? metrics.endTime - metrics.startTime : undefined
  };
  
  // In production, you'd send this to your analytics service
  console.log('[API_METRICS]', JSON.stringify(logData));
}

function validateBody(body: unknown): { 
  messages: ChatMessage[]; 
  preferences?: Preferences; 
  planDoc?: string; 
  sessionId?: string;
} {
  if (!body || typeof body !== "object") throw new Error("Invalid body");
  const b = body as Partial<IncomingBody>;
  if (!Array.isArray(b.messages)) throw new Error("Missing messages");
  
  const messages: ChatMessage[] = b.messages.map((m) => ({
    role: m!.role,
    content: String(m!.content ?? ""),
    timestamp: Date.now(),
  }));
  
  const preferences: Preferences | undefined = b.preferences;
  const planDoc: string | undefined = typeof b.planDoc === "string" ? b.planDoc : undefined;
  const sessionId: string | undefined = typeof b.sessionId === "string" ? b.sessionId : undefined;
  
  return { messages, preferences, planDoc, sessionId };
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") || "openai";

  const metrics: RequestMetrics = {
    timestamp: new Date().toISOString(),
    provider,
    messageCount: 0,
    startTime,
    success: false
  };

  let messages: ChatMessage[] = [];
  let preferences: Preferences | undefined;
  let planDoc: string | undefined;
  let sessionId: string;
  let userQuery = "";
  
  try {
    const json = await req.json();
    const v = validateBody(json);
    messages = v.messages;
    preferences = v.preferences;
    planDoc = v.planDoc;
    sessionId = v.sessionId || randomUUID(); // Generate new session ID if not provided
    metrics.messageCount = messages.length;
    
    // Extract the user query (latest user message)
    const latestUserMessage = messages.filter(m => m.role === "user").pop();
    userQuery = latestUserMessage?.content || "";
  } catch (err) {
    metrics.endTime = Date.now();
    metrics.error = String((err as Error).message);
    logMetrics(metrics);
    
    return new Response(JSON.stringify({ error: String((err as Error).message) }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (provider !== "openai") {
    metrics.endTime = Date.now();
    metrics.error = "Unsupported provider";
    logMetrics(metrics);
    
    return new Response(JSON.stringify({ error: "Only OpenAI is supported server-side. Use WebLLM client for local." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Get existing conversation context
  let context = sessionManager.getContext(sessionId);
  
  // If this is a new session or no context exists, initialize it
  if (!context) {
    context = {
      sessionId,
      messages: [],
      preferences,
      planDoc,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    };
  } else {
    // Update context with latest preferences and plan doc
    context.preferences = preferences || context.preferences;
    context.planDoc = planDoc || context.planDoc;
  }

  // Add new messages to the session (usually just the latest user message)
  const newUserMessages = messages.filter(m => m.role === "user");
  for (const message of newUserMessages) {
    sessionManager.addMessage(sessionId, message);
  }

  // Get updated context after adding messages
  context = sessionManager.getContext(sessionId)!;
  
  // Prepare messages for the LLM (include conversation history)
  const conversationMessages = context.messages;
  
  const client = new OpenAILLMClient();
  const qualityMetrics = getQualityMetricsService();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let assistantContent = "";
      
      try {
        // Generate response using conversation history and context
        for await (const chunk of client.generateStream({ 
          messages: conversationMessages, 
          preferences: context.preferences, 
          planDoc: context.planDoc,
          sessionId: context.sessionId
        })) {
          assistantContent += chunk;
          controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
        }
        
        // Calculate response time
        const responseTime = Date.now() - startTime;
        
        // Add assistant response to session
        if (assistantContent.trim()) {
          sessionManager.addMessage(sessionId, {
            role: "assistant",
            content: assistantContent,
            timestamp: Date.now(),
          });
          
          // Record interaction for quality analysis
          try {
            const interactionId = await qualityMetrics.recordInteraction(
              sessionId,
              userQuery,
              assistantContent,
              responseTime,
              {
                preferences: context.preferences,
                planDoc: context.planDoc,
                provider: "openai",
                model: "gpt-4o-mini", // This should match the actual model used
              }
            );
            
            // Add interaction ID to response headers for potential feedback collection
            controller.enqueue(encoder.encode(`event: interaction\ndata: ${interactionId}\n\n`));
          } catch (metricsError) {
            console.warn('Failed to record quality metrics:', metricsError);
          }
        }
        
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        
        // Log successful completion
        metrics.endTime = Date.now();
        metrics.success = true;
        logMetrics(metrics);
        
        controller.close();
      } catch (err) {
        // Record error for quality analysis
        const responseTime = Date.now() - startTime;
        try {
          await qualityMetrics.recordInteraction(
            sessionId,
            userQuery,
            `ERROR: ${String((err as Error).message)}`,
            responseTime,
            {
              preferences: context?.preferences,
              planDoc: context?.planDoc,
              provider: "openai",
              error: true,
            }
          );
        } catch (metricsError) {
          console.warn('Failed to record error metrics:', metricsError);
        }
        
        // Log error
        metrics.endTime = Date.now();
        metrics.error = String((err as Error).message);
        logMetrics(metrics);
        
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
      "x-session-id": sessionId, // Return session ID to client
    },
  });
}

