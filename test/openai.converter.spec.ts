import fs from 'fs';
import path from 'path';
import { OpenAICanonicalEvaluationStrategy } from '../src/frameworks/openai/openaiconverter';

describe('OpenAICanonicalEvaluationStrategy', () => {
  let converter: OpenAICanonicalEvaluationStrategy;

  beforeEach(() => {
    converter = new OpenAICanonicalEvaluationStrategy();
  });

  describe('chat completions API', () => {
    it('should convert OpenAI chat completions response', () => {
      const request = {
        model: 'gpt-4o',
        messages: [
          { role: 'system' as const, content: 'Talk like a pirate.' },
          { role: 'user' as const, content: 'Are semicolons optional in JavaScript?' }
        ]
      };

      // Load chat completions response
      const responsePath = path.join(__dirname, '../temp', 'openai.chat.completions.response.json');
      const response = JSON.parse(fs.readFileSync(responsePath, 'utf8'));

      const result = converter.convertToQualifireEvaluationRequest(request, response);

      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBe(3); // system, user, assistant

      // Should have system message
      const systemMessage = result.messages.find(m => m.role === 'system');
      expect(systemMessage).toBeDefined();
      expect(systemMessage?.content).toBe('Talk like a pirate.');

      // Should have user message
      const userMessage = result.messages.find(m => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage?.content).toBe('Are semicolons optional in JavaScript?');

      // Should have assistant message
      const assistantMessage = result.messages.find(m => m.role === 'assistant');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toBeTruthy();
      expect(assistantMessage?.content).toContain('Arrr'); // Pirate language
      expect(assistantMessage?.content).toContain('semicolons'); // Response content
    });
  });

  describe('responses API', () => {
    it('should convert OpenAI responses API response', () => {
      const request = {
        model: "gpt-5",
        input: "Write a one-sentence bedtime story about a unicorn."
      };

      // Load responses API response  
      const responsePath = path.join(__dirname, '../temp', 'openai.responses.response.json');
      const response = JSON.parse(fs.readFileSync(responsePath, 'utf8'));

      const result = converter.convertToQualifireEvaluationRequest(request as any, response);

      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);

      // Should have assistant message from output
      const assistantMessage = result.messages.find(m => m.role === 'assistant');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toContain('unicorn'); // Story content
      expect(assistantMessage?.content).toContain('moonlit'); // Story content
    });
  });

  describe('message handling', () => {
    it('should handle multiple choices in chat completions', () => {
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Hello' }]
      };

      const response = {
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hi there!' },
            finish_reason: 'stop'
          },
          {
            index: 1, 
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop'
          }
        ]
      };

      const result = converter.convertToQualifireEvaluationRequest(request, response);

      expect(result.messages.length).toBe(3); // user + 2 assistant messages
      const assistantMessages = result.messages.filter(m => m.role === 'assistant');
      expect(assistantMessages.length).toBe(2);
      expect(assistantMessages[0].content).toBe('Hi there!');
      expect(assistantMessages[1].content).toBe('Hello!');
    });

    it('should handle output with multiple elements', () => {
      const request = { model: 'gpt-5' };

      const response = {
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [
              { type: 'text', text: 'First message' },
              { type: 'text', text: 'Second message' }
            ]
          }
        ]
      };

      const result = converter.convertToQualifireEvaluationRequest(request as any, response);

      expect(result.messages.length).toBe(2);
      expect(result.messages[0].content).toBe('First message');
      expect(result.messages[1].content).toBe('Second message');
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid request message', () => {
      const request = {
        model: 'gpt-4',
        messages: [{
          role: null,
          content: null
        }]
      };

      const response = {
        choices: [{
          message: { role: 'assistant', content: 'Response' }
        }]
      };

      expect(() => {
        converter.convertToQualifireEvaluationRequest(request as any, response);
      }).toThrow('Invalid request');
    });

    it('should throw error for invalid response choice', () => {
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Hello' }]
      };

      const response = {
        choices: [{
          message: { role: null, content: null }
        }]
      };

      expect(() => {
        converter.convertToQualifireEvaluationRequest(request, response as any);
      }).toThrow('Invalid response');
    });

    it('should throw error for invalid output element', () => {
      const request = { model: 'gpt-5' };

      const response = {
        output: [{
          type: 'message',
          role: 'assistant',
          content: [{ type: 'invalid', text: null }]
        }]
      };

      expect(() => {
        converter.convertToQualifireEvaluationRequest(request as any, response);
      }).toThrow('Invalid output');
    });

    it('should throw error when no messages found', () => {
      const request = { model: 'gpt-4' };
      const response = {};

      expect(() => {
        converter.convertToQualifireEvaluationRequest(request as any, response);
      }).toThrow('Invalid request or response');
    });
  });

  describe('edge cases', () => {
    it('should handle empty messages array', () => {
      const request = { model: 'gpt-4', messages: [] };
      const response = {
        choices: [{
          message: { role: 'assistant', content: 'Response' }
        }]
      };

      const result = converter.convertToQualifireEvaluationRequest(request, response);
      expect(result.messages.length).toBe(1);
      expect(result.messages[0].role).toBe('assistant');
    });

    it('should handle missing optional fields', () => {
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Test' }]
      };

      const response = {
        choices: [{
          message: { role: 'assistant', content: 'Response' }
          // Missing index, finish_reason
        }]
      };

      const result = converter.convertToQualifireEvaluationRequest(request, response);
      expect(result.messages.length).toBe(2);
    });
  });
});
