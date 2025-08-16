export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp?: number; // Add timestamp for memory management
}

export interface Preferences {
  allergies?: string[];
  dislikes?: string[];
  cuisine?: string;
  budget?: "low" | "medium" | "high";
}

export interface GenerateOptions {
  messages: ChatMessage[];
  preferences?: Preferences;
  planDoc?: string;
  temperature?: number;
  maxTokens?: number;
  sessionId?: string; // Add session support
}

export interface LLMClient {
  generateStream(options: GenerateOptions): AsyncIterable<string>;
}

// New types for conversation memory
export interface ConversationContext {
  sessionId: string;
  messages: ChatMessage[];
  preferences?: Preferences;
  planDoc?: string;
  createdAt: number;
  lastUpdated: number;
  contextSummary?: string; // For long conversations
}

export interface ContextWindow {
  maxMessages: number;
  maxTokens: number; // Approximate token limit for context
}

export interface SessionManager {
  getContext(sessionId: string): ConversationContext | null;
  updateContext(context: ConversationContext): void;
  addMessage(sessionId: string, message: ChatMessage): void;
  summarizeIfNeeded(sessionId: string): void;
  cleanupOldSessions(): void;
}

