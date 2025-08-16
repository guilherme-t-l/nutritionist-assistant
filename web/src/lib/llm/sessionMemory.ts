import type { ChatMessage } from "./types";

interface SessionData {
  messages: ChatMessage[];
  lastActivity: number;
}

class SessionMemoryService {
  private sessions = new Map<string, SessionData>();
  private readonly maxMessages = 20; // Keep last 20 messages per session
  private readonly sessionTTL = 1000 * 60 * 60 * 4; // 4 hours

  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  getMessages(sessionId: string): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    
    // Check if session has expired
    if (Date.now() - session.lastActivity > this.sessionTTL) {
      this.sessions.delete(sessionId);
      return [];
    }
    
    return session.messages;
  }

  addMessage(sessionId: string, message: ChatMessage): void {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = { messages: [], lastActivity: Date.now() };
      this.sessions.set(sessionId, session);
    }
    
    session.messages.push(message);
    session.lastActivity = Date.now();
    
    // Keep only the last N messages
    if (session.messages.length > this.maxMessages) {
      session.messages = session.messages.slice(-this.maxMessages);
    }
  }

  updateMessages(sessionId: string, messages: ChatMessage[]): void {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = { messages: [], lastActivity: Date.now() };
      this.sessions.set(sessionId, session);
    }
    
    session.messages = messages.slice(-this.maxMessages);
    session.lastActivity = Date.now();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.sessionTTL) {
        this.sessions.delete(sessionId);
      }
    }
  }

  // For debugging/monitoring
  getSessionCount(): number {
    return this.sessions.size;
  }
}

// Global singleton instance
export const sessionMemory = new SessionMemoryService();

// Cleanup expired sessions every 30 minutes
setInterval(() => {
  sessionMemory.cleanup();
}, 1000 * 60 * 30);