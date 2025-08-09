"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";
type Message = { role: Role; content: string };

type Preferences = {
  allergies?: string[];
  dislikes?: string[];
  cuisine?: string;
  budget?: "low" | "medium" | "high";
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Preferences>({});
  const [showPrefs, setShowPrefs] = useState(false);
  const streamRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
    null
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nutritionist-preferences");
      if (raw) setPreferences(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "nutritionist-preferences",
        JSON.stringify(preferences)
      );
    } catch {}
  }, [preferences]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setError(null);
    setLoading(true);
    setInput("");

    const nextMessages: Message[] = [
      ...messages,
      { role: "user", content: trimmed },
      { role: "assistant", content: "" },
    ];
    setMessages(nextMessages);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: trimmed }],
          preferences,
        }),
      });

      // Handle guardrail-blocked quick response
      if (resp.headers.get("content-type")?.includes("application/json")) {
        const json = await resp.json();
        if (json?.blocked && json?.message) {
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "assistant", content: json.message };
            return copy;
          });
          setLoading(false);
          return;
        }
      }

      if (!resp.body) {
        throw new Error("No response body");
      }

      const reader = resp.body.getReader();
      streamRef.current = reader;
      const decoder = new TextDecoder();

      let assistantText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        assistantText += chunk;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: assistantText };
          return copy;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      streamRef.current = null;
    }
  };

  const stopStreaming = async () => {
    try {
      await streamRef.current?.cancel();
    } catch {}
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl p-4 sm:p-6">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Nutritionist Co‑Pilot (MVP)</h1>
          <div className="flex items-center gap-2">
                <Link className="text-sm underline" href="/">
                  Home
                </Link>
            <button
              className="rounded border px-3 py-1 text-sm hover:bg-foreground/10"
              onClick={() => setShowPrefs((v) => !v)}
            >
              {showPrefs ? "Hide" : "Preferences"}
            </button>
          </div>
        </header>

        {showPrefs && (
          <section className="mb-4 rounded-lg border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1 font-medium">Allergies (comma‑separated)</div>
                <input
                  className="w-full rounded border px-3 py-2"
                  value={(preferences.allergies ?? []).join(", ")}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setPreferences((p) => ({
                      ...p,
                      allergies: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder="peanuts, shellfish"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Dislikes (comma‑separated)</div>
                <input
                  className="w-full rounded border px-3 py-2"
                  value={(preferences.dislikes ?? []).join(", ")}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setPreferences((p) => ({
                      ...p,
                      dislikes: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder="olives, cilantro"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Cuisine</div>
                <input
                  className="w-full rounded border px-3 py-2"
                  value={preferences.cuisine ?? ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setPreferences((p) => ({ ...p, cuisine: e.target.value }))
                  }
                  placeholder="mediterranean, brazilian"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Budget</div>
                <select
                  className="w-full rounded border px-3 py-2"
                  value={preferences.budget ?? ""}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setPreferences((p) => ({
                      ...p,
                      budget: (e.target.value || undefined) as
                        | "low"
                        | "medium"
                        | "high"
                        | undefined,
                    }))
                  }
                >
                  <option value="">Select…</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>
          </section>
        )}

        <section className="mb-4 min-h-[50vh] rounded-lg border p-4">
          {messages.length === 0 && (
            <div className="text-sm text-foreground/70">
              Ask a nutrition question. I’ll respect your preferences and allergies.
            </div>
          )}
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div key={i} className="whitespace-pre-wrap">
                <span className="mr-2 text-xs font-semibold uppercase text-foreground/60">
                  {m.role === "user" ? "You" : "Assistant"}
                </span>
                <span>{m.content}</span>
              </div>
            ))}
            {loading && (
              <div className="text-xs text-foreground/60">Assistant is typing…</div>
            )}
            {error && <div className="text-xs text-red-600">{error}</div>}
          </div>
        </section>

        <section className="flex items-center gap-2">
          <input
            className="flex-1 rounded border border-foreground/20 bg-background px-3 py-2 placeholder:opacity-70"
            placeholder="e.g., What’s a high‑protein lunch under 600 kcal?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          {!loading ? (
            <button
              className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
              onClick={sendMessage}
              disabled={!input.trim()}
            >
              Send
            </button>
          ) : (
            <button
              className="rounded border px-4 py-2"
              onClick={stopStreaming}
            >
              Stop
            </button>
          )}
        </section>
      </main>
    </div>
  );
}

