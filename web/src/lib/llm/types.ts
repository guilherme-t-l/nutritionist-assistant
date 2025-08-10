export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
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
}

export interface LLMClient {
  generateStream(options: GenerateOptions): AsyncIterable<string>;
}

