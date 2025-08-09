import { cookies as cookieStore } from "next/headers";

export type StoredMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

const SESSION_COOKIE = "sessionId";
const MAX_HISTORY = 20;

// In-memory ephemeral store (per server instance)
const memoryStore: Map<string, StoredMessage[]> = new Map();

export async function getOrCreateSessionId(): Promise<string> {
  const cookies = await cookieStore();
  let id = cookies.get(SESSION_COOKIE)?.value;
  if (!id) {
    id = crypto.randomUUID();
    cookies.set(SESSION_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }
  return id;
}

export function getSessionMessages(sessionId: string): StoredMessage[] {
  return memoryStore.get(sessionId) ?? [];
}

export function appendSessionMessage(
  sessionId: string,
  message: StoredMessage
): void {
  const current = memoryStore.get(sessionId) ?? [];
  current.push(message);
  const trimmed = current.slice(-MAX_HISTORY);
  memoryStore.set(sessionId, trimmed);
}

export function appendSessionMessages(
  sessionId: string,
  messages: StoredMessage[]
): void {
  const current = memoryStore.get(sessionId) ?? [];
  const combined = [...current, ...messages];
  memoryStore.set(sessionId, combined.slice(-MAX_HISTORY));
}

