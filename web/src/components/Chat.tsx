"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { WebLLMClient } from "@/lib/llm/webllmClient";
import dynamic from "next/dynamic";
import type { ChatMessage, Preferences } from "@/lib/llm/types";
import { usePlan, type MealKey, usePlanDoc } from "@/lib/nutrition/planContext";
import type { MealItemInput } from "@/lib/nutrition/types";

type Provider = "webllm" | "openai";

// Session management utilities
const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const STORAGE_KEYS = {
  SESSION_ID: 'nutritionist_session_id',
  MESSAGES: 'nutritionist_messages',
  PREFERENCES: 'nutritionist_preferences',
} as const;

// Save data to localStorage with error handling
const saveToStorage = (key: string, data: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
};

// Load data from localStorage with error handling
const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
    return defaultValue;
  }
};

// Fix dynamic imports with proper loading and error handling
const PlanDocEditor = dynamic(() => import("./PlanDocEditor"), { 
  ssr: false,
  loading: () => <div className="p-4 text-slate-400">Loading editor...</div>
});

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="text-slate-400">Loading components...</div>
    </div>
  );
}

export default function Chat() {
  const { addItem } = usePlan();
  const [provider, setProvider] = useState<Provider>("webllm");
  const [modelId, setModelId] = useState<string>("Qwen2.5-7B-Instruct-q4f32_1-MLC");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [sessionId, setSessionId] = useState<string>("");
  const [preferences, setPreferences] = useState<Preferences>({
    allergies: [],
    dislikes: [],
    cuisine: "",
    budget: undefined,
  });

  const client = useMemo(() => new WebLLMClient(modelId, (progress: string) => {
    setStatus(progress);
  }), [modelId]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { doc, setDoc } = usePlanDoc();

  // Initialize session and load persisted data
  useEffect(() => {
    let currentSessionId = loadFromStorage(STORAGE_KEYS.SESSION_ID, '');
    
    // Generate new session if none exists
    if (!currentSessionId) {
      currentSessionId = generateSessionId();
      saveToStorage(STORAGE_KEYS.SESSION_ID, currentSessionId);
    }
    
    setSessionId(currentSessionId);
    
    // Load persisted messages and preferences
    const savedMessages = loadFromStorage<ChatMessage[]>(STORAGE_KEYS.MESSAGES, []);
    const savedPreferences = loadFromStorage<Preferences>(STORAGE_KEYS.PREFERENCES, {
      allergies: [],
      dislikes: [],
      cuisine: "",
      budget: undefined,
    });
    
    setMessages(savedMessages);
    setPreferences(savedPreferences);
    
    console.log('Session loaded:', { 
      sessionId: currentSessionId, 
      messageCount: savedMessages.length,
      preferences: savedPreferences 
    });
  }, []);

  // Persist messages whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      saveToStorage(STORAGE_KEYS.MESSAGES, messages);
    }
  }, [messages]);

  // Persist preferences whenever they change
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PREFERENCES, preferences);
  }, [preferences]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const parseSlashAdd = (text: string): { meal: MealKey; item: MealItemInput } | null => {
    // Format: /add <foodId|name> <quantity><unit> to <meal>
    // Examples: /add oats_rolled 50g to breakfast | /add milk_skim 240ml to lunch | /add egg_whole 2piece to dinner
    const match = text.match(/^\/add\s+(\S+)\s+(\d+(?:\.\d+)?)(g|ml|piece)\s+(?:to\s+)?(breakfast|lunch|dinner|snacks)$/i);
    if (!match) return null;
    const [, food, qty, unit, mealStr] = match;
    const mealMap: Record<string, MealKey> = {
      breakfast: "Breakfast",
      lunch: "Lunch",
      dinner: "Dinner",
      snacks: "Snacks",
    };
    return {
      meal: mealMap[mealStr.toLowerCase()],
      item: { foodId: food, portion: { quantity: Number(qty), unit: unit as "g" | "ml" | "piece" } },
    };
  };

  function extractPlanDocFromText(text: string): string | null {
    // 1) Prefer fenced code blocks that contain a meal plan
    const codeBlockRegex = /```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const block = (match[1] || "").trim();
      if (/Meal Plan/i.test(block) || /^(Breakfast:|Lunch:|Dinner:|Snacks:)/m.test(block)) {
        return block;
      }
    }

    // 2) Fallback: capture from "Meal Plan" header to the end if present
    const headerIdx = text.search(/Meal Plan/i);
    if (headerIdx !== -1) {
      const candidate = text.slice(headerIdx).trim();
      if (/Breakfast:/.test(candidate) || /Lunch:/.test(candidate) || /Dinner:/.test(candidate) || /Snacks:/.test(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  function maybeUpdateDocFromAssistant(assistantText: string) {
    const extracted = extractPlanDocFromText(assistantText);
    if (!extracted) return;
    if (extracted.trim() === doc.trim()) return;
    setDoc(extracted);
  }

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isBusy) return;
    // Slash command: /add ... modifies plan locally and does not send to LLM
    if (text.startsWith("/add")) {
      const parsed = parseSlashAdd(text);
      if (parsed) {
        addItem(parsed.meal, parsed.item);
        setInput("");
        setMessages((prev) => [...prev, { role: "assistant", content: `Added to ${parsed.meal}.` } as ChatMessage]);
        return;
      }
    }
    setInput("");
    const nextMessages = [...messages, { role: "user", content: text } as ChatMessage];
    setMessages(nextMessages);
    setIsBusy(true);
    setStatus("Thinking…");

    if (provider === "webllm") {
      const startTime = Date.now();
      let assistantContent = "";
      let firstTokenTime: number | null = null;
      
      // Client-side metrics for WebLLM
      const clientMetrics = {
        timestamp: new Date().toISOString(),
        provider: "webllm",
        modelId,
        messageCount: nextMessages.length,
        startTime,
        success: false,
        error: undefined as string | undefined,
        firstTokenLatency: undefined as number | undefined,
        totalDuration: undefined as number | undefined,
        responseLength: 0
      };

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      try {
        for await (const delta of client.generateStream({ messages: nextMessages, preferences, planDoc: doc })) {
          if (firstTokenTime === null) {
            firstTokenTime = Date.now();
            clientMetrics.firstTokenLatency = firstTokenTime - startTime;
          }
          assistantContent += delta;
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "assistant", content: assistantContent };
            return copy;
          });
        }
        clientMetrics.success = true;
        clientMetrics.responseLength = assistantContent.length;
      } catch (err) {
        clientMetrics.error = String((err as Error).message);
        setMessages((prev) => [...prev, { role: "assistant", content: String((err as Error).message) }]);
      } finally {
        // Log client metrics
        clientMetrics.totalDuration = Date.now() - startTime;
        console.log('[CLIENT_METRICS]', JSON.stringify(clientMetrics));
        
        // Attempt to sync plan doc from the final assistant message
        try {
          maybeUpdateDocFromAssistant(assistantContent);
        } catch {
          // no-op if parsing fails
        }
        setIsBusy(false);
        setStatus("Ready");
      }
      return;
    }

    // openai via server API (SSE)
    const openaiStartTime = Date.now();
    let assistantContentOpenAI = "";
    let openaiFirstTokenTime: number | null = null;
    
    // Client-side metrics for OpenAI
    const openaiMetrics = {
      timestamp: new Date().toISOString(),
      provider: "openai",
      messageCount: nextMessages.length,
      startTime: openaiStartTime,
      success: false,
      error: undefined as string | undefined,
      firstTokenLatency: undefined as number | undefined,
      totalDuration: undefined as number | undefined,
      responseLength: 0
    };
    
    try {
      const resp = await fetch(`/api/chat?provider=openai`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ 
          messages: [{ role: "user", content: text }], // Send only the new message
          preferences, 
          planDoc: doc,
          sessionId: sessionId || undefined 
        }),
      });
      if (!resp.ok || !resp.body) throw new Error(`Request failed: ${resp.status}`);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      assistantContentOpenAI = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split(/\n\n/).filter(Boolean);
        for (const line of lines) {
          if (line.includes("[DONE]")) continue;
          
          // Handle sessionId event
          if (line.startsWith("event: sessionId")) {
            const sessionIdMatch = line.match(/data: (.+)/);
            if (sessionIdMatch) {
              setSessionId(sessionIdMatch[1]);
            }
            continue;
          }
          
          const dataIdx = line.indexOf("data:");
          if (dataIdx !== -1) {
            const data = line.slice(dataIdx + 5).trim();
            if (data && openaiFirstTokenTime === null) {
              openaiFirstTokenTime = Date.now();
              openaiMetrics.firstTokenLatency = openaiFirstTokenTime - openaiStartTime;
            }
            assistantContentOpenAI += data;
            setMessages((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = { role: "assistant", content: assistantContentOpenAI };
              return copy;
            });
          }
        }
      }
      openaiMetrics.success = true;
      openaiMetrics.responseLength = assistantContentOpenAI.length;
    } catch (err) {
      openaiMetrics.error = String((err as Error).message);
      setMessages((prev) => [...prev, { role: "assistant", content: String((err as Error).message) }]);
    } finally {
      // Log client metrics
      openaiMetrics.totalDuration = Date.now() - openaiStartTime;
      console.log('[CLIENT_METRICS]', JSON.stringify(openaiMetrics));
      
      // Attempt to sync plan doc from the final assistant message
      try { maybeUpdateDocFromAssistant(assistantContentOpenAI); } catch { /* no-op if parsing fails */ }
      setIsBusy(false);
      setStatus("Ready");
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleArrayInput = (value: string) =>
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const clearSession = () => {
    // Clear localStorage
    localStorage.removeItem(STORAGE_KEYS.MESSAGES);
    localStorage.removeItem(STORAGE_KEYS.PREFERENCES);
    localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
    
    // Reset state
    setMessages([]);
    setPreferences({
      allergies: [],
      dislikes: [],
      cuisine: "",
      budget: undefined,
    });
    
    // Generate new session
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    saveToStorage(STORAGE_KEYS.SESSION_ID, newSessionId);
    
    console.log('Session cleared, new sessionId:', newSessionId);
  };

  return (
    <div className="min-h-[100vh] grid grid-rows-[auto_1fr_auto] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 backdrop-blur bg-slate-900/70 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="font-semibold">Nutritionist Assistant</div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearSession}
              className="bg-slate-800 hover:bg-slate-700 border border-white/10 rounded px-2 py-1 text-sm"
              title="Clear chat history and start new session"
            >
              Clear Session
            </button>
            <select
              className="bg-slate-800 border border-white/10 rounded px-2 py-1"
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              aria-label="Model provider"
            >
              <option value="webllm">Local (WebLLM)</option>
              <option value="openai">OpenAI (server)</option>
            </select>
            {provider === "webllm" && (
              <select
                className="bg-slate-800 border border-white/10 rounded px-2 py-1"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                aria-label="Local model"
              >
                {/* Recommended Models */}
                <option value="Qwen2.5-7B-Instruct-q4f32_1-MLC">🌟 Qwen2.5 7B Instruct (Recommended)</option>
                <option value="Llama-3.2-8B-Instruct-q4f32_1-MLC">🦙 Llama 3.2 8B Instruct</option>
                <option value="Llama-3.3-70B-Instruct-q4f32_1-MLC">🚀 Llama 3.3 70B Instruct (Large - ~40GB)</option>
                
                {/* Legacy/Lightweight Models */}
                <optgroup label="Lightweight Models">
                  <option value="Llama-3.2-1B-Instruct-q4f32_1-MLC">Llama 3.2 1B Instruct (Fast)</option>
                  <option value="Phi-3-mini-4k-instruct-q4f16_1-MLC">Phi-3 Mini 4K Instruct</option>
                  <option value="Qwen2-1.5B-Instruct-q4f16_1-MLC">Qwen2 1.5B Instruct</option>
                </optgroup>
              </select>
            )}
            
            {/* Performance warning for large models */}
            {provider === "webllm" && modelId.includes("70B") && (
              <div className="mt-2 p-2 bg-amber-900/20 border border-amber-500/30 rounded text-amber-200 text-xs">
                ⚠️ <strong>Large Model Selected:</strong> Initial download is ~40GB and may take 10+ minutes. 
                Consider using a smaller model for faster response times.
              </div>
            )}
            
            {provider === "webllm" && (modelId.includes("7B") || modelId.includes("8B")) && !modelId.includes("70B") && (
              <div className="mt-2 p-2 bg-green-900/20 border border-green-500/30 rounded text-green-200 text-xs">
                ✅ <strong>Optimized Model:</strong> Good balance of performance and speed (~3-4GB download).
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,520px)] gap-4 h-[calc(100vh-110px)]">
        {/* Left column: Chat column */}
        <div className="min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 lg:pr-2">
            {messages.length === 0 && (
              <div className="text-center text-slate-400 mt-8">
                <h2 className="text-lg font-semibold text-slate-300 mb-2">Welcome to your Nutritionist Assistant!</h2>
                <p className="mb-4">I can help you with:</p>
                <ul className="text-sm space-y-1 text-left max-w-md mx-auto">
                  <li>• Nutrition advice and food recommendations</li>
                  <li>• Macro calculations and meal planning</li>
                  <li>• Food substitutions based on your preferences</li>
                  <li>• Answering questions about specific foods</li>
                </ul>
                <p className="text-xs mt-4 text-slate-500">
                  Note: This is educational guidance only, not medical advice. Please consult healthcare professionals for medical concerns.
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className="flex items-start gap-2">
                <div
                  className={`w-7 h-7 rounded-full grid place-items-center text-sm font-bold border ${m.role === "user" ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" : "bg-violet-500/20 text-violet-300 border-violet-500/30"}`}
                >
                  {m.role === "user" ? "U" : "A"}
                </div>
                <div className="bg-slate-900/70 border border-white/10 rounded-lg p-2.5 whitespace-pre-wrap max-w-[80%]">
                  {m.content || (m.role === "assistant" && isBusy ? "..." : "")}
                </div>
              </div>
            ))}
            {isBusy && (
              <div className="flex items-center gap-2 text-slate-400">
                <div className="w-7 h-7 rounded-full grid place-items-center text-sm border bg-violet-500/20 text-violet-300 border-violet-500/30">
                  A
                </div>
                <div className="bg-slate-900/70 border border-white/10 rounded-lg p-2.5">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-white/10 pt-3 grid gap-3">
          <div className="grid sm:grid-cols-4 gap-2">
            <input
              className="bg-slate-900/70 border border-white/10 rounded px-2 py-1 sm:col-span-1"
              placeholder="Allergies (comma separated)"
              aria-label="Allergies"
              onChange={(e) => setPreferences((p) => ({ ...p, allergies: handleArrayInput(e.target.value) }))}
            />
            <input
              className="bg-slate-900/70 border border-white/10 rounded px-2 py-1 sm:col-span-1"
              placeholder="Dislikes"
              aria-label="Dislikes"
              onChange={(e) => setPreferences((p) => ({ ...p, dislikes: handleArrayInput(e.target.value) }))}
            />
            <input
              className="bg-slate-900/70 border border-white/10 rounded px-2 py-1 sm:col-span-1"
              placeholder="Cuisine"
              aria-label="Cuisine"
              onChange={(e) => setPreferences((p) => ({ ...p, cuisine: e.target.value }))}
            />
            <select
              className="bg-slate-900/70 border border-white/10 rounded px-2 py-1 sm:col-span-1"
              aria-label="Budget"
              onChange={(e) => setPreferences((p) => ({ ...p, budget: e.target.value as Preferences["budget"] }))}
              defaultValue=""
            >
              <option value="">Budget</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              className="flex-1 bg-slate-900/70 border border-white/10 rounded px-3 py-2"
              placeholder="Type your message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Message"
            />
            <button
              className="px-4 py-2 rounded bg-gradient-to-r from-cyan-400 to-violet-400 text-slate-900 font-semibold disabled:opacity-50 transition-opacity"
              onClick={handleSend}
              disabled={isBusy || !input.trim()}
              aria-busy={isBusy}
              title={!input.trim() ? "Enter a message to send" : "Send message"}
            >
              {isBusy ? "..." : "Send"}
            </button>
          </div>
          <div className="text-slate-400 text-sm" aria-live="polite">
            {status} {sessionId && <span className="opacity-60">• Session: {sessionId.slice(-8)}</span>}
          </div>
          </div>
        </div>
        {/* Right column: Plan doc editor */}
        <div className="hidden lg:flex h-full min-h-0">
          <Suspense fallback={<LoadingFallback />}>
            <PlanDocEditor />
          </Suspense>
        </div>
      </main>
      <footer className="border-t border-white/10 px-4 py-2 text-center text-slate-400">Educational nutrition guidance only, not medical advice.</footer>
    </div>
  );
}

