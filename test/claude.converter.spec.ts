import fs from 'fs';
import path from 'path';
import { ClaudeCanonicalEvaluationStrategy } from '../src/frameworks/claude/claudeconverter';

describe('ClaudeCanonicalEvaluationStrategy', () => {
  let converter: ClaudeCanonicalEvaluationStrategy;

  beforeEach(() => {
    converter = new ClaudeCanonicalEvaluationStrategy();
  });

  describe('streaming response', () => {
    it('should convert Claude streaming chunks to accumulated content', () => {
      const request = {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: "You are a not so helpful assistant. Only giving to opposite answers of what I ask.",
        messages: [{
          role: "user" as const,
          content: "How to write an awesome prompt to evaluate if sp500 is going to go up or down?"
        }]
      };

      // Load all streaming chunks
      const chunks = [];
      for (let i = 0; i <= 30; i++) {
        const chunkPath = path.join(__dirname, '../temp', `claude.messages.create.response.chunk.${i}.json`);
        if (fs.existsSync(chunkPath)) {
          const chunkData = JSON.parse(fs.readFileSync(chunkPath, 'utf8'));
          chunks.push(chunkData);
        }
      }

      const result = converter.convertToQualifireEvaluationRequest(request, chunks);

      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(1);
      
      // Should have system message
      const systemMessage = result.messages.find(m => m.role === 'system');
      expect(systemMessage).toBeDefined();
      expect(systemMessage?.content).toBe("You are a not so helpful assistant. Only giving to opposite answers of what I ask.");

      // Should have user message
      const userMessage = result.messages.find(m => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage?.content).toBe("How to write an awesome prompt to evaluate if sp500 is going to go up or down?");

      // Should have assistant message with accumulated content
      const assistantMessage = result.messages.find(m => m.role === 'assistant');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toBeTruthy();
      expect(assistantMessage?.content?.length).toBeGreaterThan(100); // Should have substantial content
      expect(assistantMessage?.content).toContain("write a terrible prompt"); // Content from the stream
    });
  });

  describe('non-streaming response', () => {
    it('should convert Claude non-streaming response', () => {
      const request = {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: "You are a helpful assistant.",
        messages: [{
          role: "user" as const,
          content: "Hello, how are you?"
        }]
      };

      // Load non-streaming response
      const responsePath = path.join(__dirname, '../temp', 'claude.messages.create.response.json');
      const response = JSON.parse(fs.readFileSync(responsePath, 'utf8'));

      const result = converter.convertToQualifireEvaluationRequest(request, response);

      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBe(3); // system, user, assistant
      
      // Should have system message
      const systemMessage = result.messages.find(m => m.role === 'system');
      expect(systemMessage).toBeDefined();
      
      // Should have user message
      const userMessage = result.messages.find(m => m.role === 'user');
      expect(userMessage).toBeDefined();
      
      // Should have assistant message
      const assistantMessage = result.messages.find(m => m.role === 'assistant');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toContain("write a terrible prompt");
    });
  });

  describe('message content handling', () => {
    it('should handle string content', () => {
      const request = {
        model: "claude-3",
        messages: [{
          role: "user" as const,
          content: "Simple string message"
        }]
      };

      const response = {
        content: [{
          type: "text",
          text: "Simple response"
        }]
      };

      const result = converter.convertToQualifireEvaluationRequest(request, response);
      
      const userMessage = result.messages.find(m => m.role === 'user');
      expect(userMessage?.content).toBe("Simple string message");
      
      const assistantMessage = result.messages.find(m => m.role === 'assistant');
      expect(assistantMessage?.content).toBe("Simple response");
    });

    it('should handle array content', () => {
      const request = {
        model: "claude-3",
        messages: [{
          role: "user" as const,
          content: [
            { type: "text", text: "First part" },
            { type: "text", text: "Second part" }
          ]
        }]
      };

      const response = {
        content: [{
          type: "text", 
          text: "Response text"
        }]
      };

      const result = converter.convertToQualifireEvaluationRequest(request, response);
      
      const userMessage = result.messages.find(m => m.role === 'user');
      expect(userMessage?.content).toBe("First part Second part");
    });

    it('should handle tool_use content', () => {
      const request = {
        model: "claude-3",
        messages: [{ role: "user" as const, content: "Use a tool" }]
      };

      const response = {
        content: [{
          type: "tool_use",
          name: "calculator"
        }]
      };

      const result = converter.convertToQualifireEvaluationRequest(request, response);
      
      const assistantMessage = result.messages.find(m => m.role === 'assistant');
      expect(assistantMessage?.content).toBe("Tool used: calculator");
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid request message', () => {
      const request = {
        model: "claude-3",
        messages: [{
          role: null,
          content: null
        }]
      };

      const response = { content: [{ type: "text", text: "Response" }] };

      expect(() => {
        converter.convertToQualifireEvaluationRequest(request as any, response);
      }).toThrow("Invalid Claude request message");
    });

    it('should throw error when no valid messages found', () => {
      const request = { model: "claude-3" };
      const response = {};

      expect(() => {
        converter.convertToQualifireEvaluationRequest(request as any, response);
      }).toThrow("Invalid Claude request or response - no valid messages found");
    });
  });
});
