import { NextResponse } from "next/server";
import { getLLMClient } from "@/lib/llm";
import { applyGuardrails } from "@/lib/guardrails";
import { buildMessages, type ChatMessage } from "@/lib/prompt";
import {
  appendSessionMessage,
  getOrCreateSessionId,
  getSessionMessages,
} from "@/lib/session";

type RequestPayload = {
  messages?: { role: "user" | "assistant" | "system"; content: string }[];
  preferences?: {
    allergies?: string[];
    dislikes?: string[];
    cuisine?: string;
    budget?: "low" | "medium" | "high";
  };
};

export const runtime = "nodejs";

export async function POST(req: Request) {
  const startedAt = Date.now();
  let payload: RequestPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = await getOrCreateSessionId();
  const history = getSessionMessages(sessionId).filter(
    (m) => m.role !== "system"
  ) as ChatMessage[];

  const latestUser = (payload.messages ?? [])
    .slice()
    .reverse()
    .find((m) => m.role === "user");

  if (!latestUser?.content?.trim()) {
    return NextResponse.json(
      { error: "Missing user message" },
      { status: 400 }
    );
  }

  const guard = applyGuardrails(latestUser.content);
  if (guard.blocked) {
    const disclaimer = guard.disclaimer ?? "";
    appendSessionMessage(sessionId, {
      role: "user",
      content: latestUser.content,
    });
    appendSessionMessage(sessionId, {
      role: "assistant",
      content:
        disclaimer +
        "\n\nI can help with general nutrition education, meal ideas, and macro awareness. Could you share your goals (e.g., weight loss/maintenance/gain), any allergies, cuisine preferences, and budget?",
    });
    return NextResponse.json(
      {
        blocked: true,
        message: disclaimer,
      },
      { status: 200 }
    );
  }

  const sanitizedUserContent = guard.sanitizedContent ?? latestUser.content;

  const assembled: ChatMessage[] = buildMessages(
    sanitizedUserContent,
    history,
    payload.preferences
  );

  // Persist the user message now
  appendSessionMessage(sessionId, { role: "user", content: sanitizedUserContent });

  const provider = new URL(req.url).searchParams.get("provider") ?? "openai";
  const llm = getLLMClient(provider);

  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      try {
        for await (const textChunk of llm.streamChat(assembled)) {
          fullText += textChunk;
          controller.enqueue(encoder.encode(textChunk));
        }
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`\n[error] ${message}`));
        controller.close();
      } finally {
        // Save assistant message to session
        if (fullText.trim().length > 0) {
          appendSessionMessage(sessionId, {
            role: "assistant",
            content: fullText,
          });
        }
        // Basic logging (redacted): duration only
        const durationMs = Date.now() - startedAt;
        console.log(
          JSON.stringify({
            event: "chat.complete",
            durationMs,
            provider,
            model: "gpt-4o-mini",
          })
        );
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

