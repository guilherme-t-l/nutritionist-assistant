import { NextRequest } from "next/server";
import { OpenAILLMClient } from "@/lib/llm/openaiClient";
import type { ChatMessage, Preferences } from "@/lib/llm/types";

export const runtime = "nodejs";

interface IncomingBody {
  messages: { role: ChatMessage["role"]; content: string }[];
  preferences?: Preferences;
  planDoc?: string;
}

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
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") || "openai";

  let messages: ChatMessage[] = [];
  let preferences: Preferences | undefined;
  let planDoc: string | undefined;
  try {
    const json = await req.json();
    const v = validateBody(json);
    messages = v.messages;
    preferences = v.preferences;
    planDoc = v.planDoc;
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error).message) }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (provider !== "openai") {
    return new Response(JSON.stringify({ error: "Only OpenAI is supported server-side. Use WebLLM client for local." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const client = new OpenAILLMClient();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of client.generateStream({ messages, preferences, planDoc })) {
          controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
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

