import type { ConversationContext, ChatMessage, SessionManager, ContextWindow } from "./types";

class InMemorySessionManager implements SessionManager {
  private sessions = new Map<string, ConversationContext>();
  private readonly contextWindow: ContextWindow = {
    maxMessages: 50, // Keep last 50 messages
    maxTokens: 8000, // Approximate token limit (leave room for system prompt)
  };
  private readonly sessionTTL = 24 * 60 * 60 * 1000; // 24 hours

  getContext(sessionId: string): ConversationContext | null {
    const context = this.sessions.get(sessionId);
    if (!context) return null;

    // Check if session is expired
    if (Date.now() - context.lastUpdated > this.sessionTTL) {
      this.sessions.delete(sessionId);
      return null;
    }

    return context;
  }

  updateContext(context: ConversationContext): void {
    context.lastUpdated = Date.now();
    this.sessions.set(context.sessionId, context);
  }

  addMessage(sessionId: string, message: ChatMessage): void {
    let context = this.getContext(sessionId);
    
    if (!context) {
      // Create new session
      context = {
        sessionId,
        messages: [],
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };
    }

    // Add timestamp if not present
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }

    context.messages.push(message);
    this.updateContext(context);
    
    // Check if we need to summarize
    this.summarizeIfNeeded(sessionId);
  }

  summarizeIfNeeded(sessionId: string): void {
    const context = this.getContext(sessionId);
    if (!context) return;

    // If we have too many messages, keep the most recent ones and summarize the older ones
    if (context.messages.length > this.contextWindow.maxMessages) {
      const messagesToKeep = 30; // Keep last 30 messages
      const messagesToSummarize = context.messages.slice(0, -messagesToKeep);
      const recentMessages = context.messages.slice(-messagesToKeep);

      // Create a simple summary of older messages
      const summary = this.createMessageSummary(messagesToSummarize);
      
      context.contextSummary = summary;
      context.messages = recentMessages;
      this.updateContext(context);
    }
  }

  private createMessageSummary(messages: ChatMessage[]): string {
    const userMessages = messages.filter(m => m.role === "user");
    const assistantMessages = messages.filter(m => m.role === "assistant");
    
    const topics = new Set<string>();
    const preferences = new Set<string>();
    
    // Extract key topics and preferences from conversation
    userMessages.forEach(msg => {
      const content = msg.content.toLowerCase();
      if (content.includes("allerg")) topics.add("allergies discussed");
      if (content.includes("diet")) topics.add("dietary preferences");
      if (content.includes("meal plan")) topics.add("meal planning");
      if (content.includes("macro") || content.includes("protein") || content.includes("carb")) topics.add("macronutrients");
      if (content.includes("weight") || content.includes("calorie")) topics.add("weight management");
    });

    return `Previous conversation context: User discussed ${Array.from(topics).join(", ")}. ${userMessages.length} user messages and ${assistantMessages.length} assistant responses.`;
  }

  cleanupOldSessions(): void {
    const now = Date.now();
    for (const [sessionId, context] of this.sessions.entries()) {
      if (now - context.lastUpdated > this.sessionTTL) {
        this.sessions.delete(sessionId);
      }
    }
  }

  // Utility methods
  getSessionCount(): number {
    return this.sessions.size;
  }

  getSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }
}

// Singleton instance
const sessionManager = new InMemorySessionManager();

// Cleanup old sessions every hour
if (typeof window === "undefined") { // Server-side only
  setInterval(() => {
    sessionManager.cleanupOldSessions();
  }, 60 * 60 * 1000);
}

export { sessionManager };
export type { SessionManager };