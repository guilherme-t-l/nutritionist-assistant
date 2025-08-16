import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sessionManager } from '../sessionManager';
import type { ChatMessage } from '../types';

describe('SessionManager', () => {
  beforeEach(() => {
    // Clear any existing sessions before each test
    sessionManager.getSessionIds().forEach(id => {
      // We need to access the private method, so we'll clear sessions manually
    });
  });

  it('should create a new session context when none exists', () => {
    const sessionId = 'test-session-1';
    const message: ChatMessage = {
      role: 'user',
      content: 'Hello, this is a test message',
      timestamp: Date.now(),
    };

    sessionManager.addMessage(sessionId, message);
    
    const context = sessionManager.getContext(sessionId);
    expect(context).toBeDefined();
    expect(context?.sessionId).toBe(sessionId);
    expect(context?.messages).toHaveLength(1);
    expect(context?.messages[0]).toEqual(message);
  });

  it('should add messages to existing session', () => {
    const sessionId = 'test-session-2';
    const message1: ChatMessage = {
      role: 'user',
      content: 'First message',
      timestamp: Date.now(),
    };
    const message2: ChatMessage = {
      role: 'assistant',
      content: 'Second message',
      timestamp: Date.now() + 1000,
    };

    sessionManager.addMessage(sessionId, message1);
    sessionManager.addMessage(sessionId, message2);
    
    const context = sessionManager.getContext(sessionId);
    expect(context?.messages).toHaveLength(2);
    expect(context?.messages[0].content).toBe('First message');
    expect(context?.messages[1].content).toBe('Second message');
  });

  it('should update lastUpdated timestamp when adding messages', () => {
    const sessionId = 'test-session-3';
    const message: ChatMessage = {
      role: 'user',
      content: 'Test message',
      timestamp: Date.now(),
    };

    const beforeTime = Date.now();
    sessionManager.addMessage(sessionId, message);
    const afterTime = Date.now();
    
    const context = sessionManager.getContext(sessionId);
    expect(context?.lastUpdated).toBeGreaterThanOrEqual(beforeTime);
    expect(context?.lastUpdated).toBeLessThanOrEqual(afterTime);
  });

  it('should add timestamp to messages if not present', () => {
    const sessionId = 'test-session-4';
    const messageWithoutTimestamp: ChatMessage = {
      role: 'user',
      content: 'Message without timestamp',
    };

    sessionManager.addMessage(sessionId, messageWithoutTimestamp);
    
    const context = sessionManager.getContext(sessionId);
    expect(context?.messages[0].timestamp).toBeDefined();
    expect(typeof context?.messages[0].timestamp).toBe('number');
  });

  it('should handle conversation summarization for long conversations', () => {
    const sessionId = 'test-session-5';
    
    // Add many messages to trigger summarization
    for (let i = 0; i < 60; i++) {
      const message: ChatMessage = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i} about nutrition and diet planning`,
        timestamp: Date.now() + i * 1000,
      };
      sessionManager.addMessage(sessionId, message);
    }
    
    const context = sessionManager.getContext(sessionId);
    // Should have triggered summarization
    expect(context?.messages.length).toBeLessThan(60);
    expect(context?.contextSummary).toBeDefined();
    expect(context?.contextSummary).toContain('conversation context');
  });

  it('should return null for non-existent session', () => {
    const context = sessionManager.getContext('non-existent-session');
    expect(context).toBeNull();
  });

  it('should expire old sessions', () => {
    const sessionId = 'test-session-6';
    const message: ChatMessage = {
      role: 'user',
      content: 'Test message',
      timestamp: Date.now(),
    };

    sessionManager.addMessage(sessionId, message);
    
    // Mock time progression (25 hours)
    const originalNow = Date.now;
    vi.spyOn(Date, 'now').mockImplementation(() => originalNow() + 25 * 60 * 60 * 1000);
    
    const context = sessionManager.getContext(sessionId);
    expect(context).toBeNull();
    
    vi.restoreAllMocks();
  });

  it('should generate contextSummary for nutrition-related conversations', () => {
    const sessionId = 'test-session-7';
    
    const nutritionMessages: ChatMessage[] = [
      { role: 'user', content: 'I have allergies to nuts', timestamp: Date.now() },
      { role: 'assistant', content: 'I understand you have nut allergies', timestamp: Date.now() + 1000 },
      { role: 'user', content: 'Can you help with meal planning?', timestamp: Date.now() + 2000 },
      { role: 'assistant', content: 'Yes, I can help with diet planning', timestamp: Date.now() + 3000 },
      { role: 'user', content: 'What about macronutrients?', timestamp: Date.now() + 4000 },
    ];

    nutritionMessages.forEach(msg => sessionManager.addMessage(sessionId, msg));

    // Add enough messages to trigger summarization
    for (let i = 0; i < 50; i++) {
      sessionManager.addMessage(sessionId, {
        role: 'user',
        content: `Additional message ${i}`,
        timestamp: Date.now() + 5000 + i * 1000,
      });
    }
    
    const context = sessionManager.getContext(sessionId);
    expect(context?.contextSummary).toBeDefined();
    expect(context?.contextSummary).toMatch(/allergies discussed|meal planning|macronutrients/);
  });
});