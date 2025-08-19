import fs from 'fs';
import path from 'path';
import { VercelAICanonicalEvaluationStrategy } from '../src/frameworks/vercelai/vercelaiconverter';

describe('VercelAICanonicalEvaluationStrategy', () => {
  let converter: VercelAICanonicalEvaluationStrategy;

  beforeEach(() => {
    converter = new VercelAICanonicalEvaluationStrategy();
  });

  describe('streaming response (array of strings)', () => {
    it('should convert Vercel AI streaming response to accumulated content', () => {
      const request = {
        systemPrompt: 'You are a helpful assistant.',
        prompt: 'Are the sky blue?',
      };

      // Load streaming response (array of strings)
      const responsePath = path.join(
        __dirname,
        '../test/res',
        'vercelai.chats.create.response.json'
      );
      const response = JSON.parse(fs.readFileSync(responsePath, 'utf8'));

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages).toBeDefined();
      expect(result.messages?.length).toBe(3); // system, user, assistant

      // Should have system message
      const systemMessage = result.messages?.find(m => m.role === 'system');
      expect(systemMessage).toBeDefined();
      expect(systemMessage?.content).toBe('You are a helpful assistant.');

      // Should have user message
      const userMessage = result.messages?.find(m => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage?.content).toBe('Are the sky blue?');

      // Should have assistant message with accumulated content
      const assistantMessage = result.messages?.find(
        m => m.role === 'assistant'
      );
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toBeTruthy();
      expect(assistantMessage?.content).toContain('sky'); // Should contain the topic
      expect(assistantMessage?.content).toContain('blue'); // Should contain the response
      expect(assistantMessage?.content?.length).toBeGreaterThan(100); // Should be substantial
    });
  });

  describe('generateText response with text property', () => {
    it('should handle generateText response with text property', () => {
      const request = {
        model: 'gpt-4',
        prompt: 'What is AI?',
      };

      const response = {
        text: 'AI stands for Artificial Intelligence.',
      };

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages?.length).toBe(2); // user and assistant

      const userMessage = result.messages?.find(m => m.role === 'user');
      expect(userMessage?.content).toBe('What is AI?');

      const assistantMessage = result.messages?.find(
        m => m.role === 'assistant'
      );
      expect(assistantMessage?.content).toBe(
        'AI stands for Artificial Intelligence.'
      );
    });
  });

  describe('useChat messages', () => {
    it('should handle useChat messages with string content', () => {
      const request = {
        systemPrompt: 'You are helpful.',
      };

      const response = {
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      };

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages?.length).toBe(4); // system prompt + 3 from messages

      // Check system prompt message
      const systemMessages = result.messages?.filter(m => m.role === 'system');
      expect(systemMessages?.length).toBe(2); // One from request, one from response

      const userMessage = result.messages?.find(m => m.role === 'user');
      expect(userMessage?.content).toBe('Hello');

      const assistantMessage = result.messages?.find(
        m => m.role === 'assistant'
      );
      expect(assistantMessage?.content).toBe('Hi there!');
    });

    it('should handle useChat messages with parts content', () => {
      const request = {
        prompt: 'Question',
      };

      const response = {
        messages: [
          {
            role: 'user',
            parts: [
              { type: 'text', text: 'First part' },
              { type: 'text', text: 'Second part' },
            ],
          },
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Response part 1' },
              { type: 'text', text: 'Response part 2' },
            ],
          },
        ],
      };

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages?.length).toBe(3); // user prompt + 2 from messages

      const messagesFromResponse = result.messages?.filter(
        m => m.role !== 'user' || m.content !== 'Question'
      );
      expect(messagesFromResponse?.length).toBe(2);

      // Should join parts with spaces
      const userFromMessages = messagesFromResponse?.find(
        m => m.role === 'user'
      );
      expect(userFromMessages?.content).toBe('First part Second part');

      const assistantFromMessages = messagesFromResponse?.find(
        m => m.role === 'assistant'
      );
      expect(assistantFromMessages?.content).toBe(
        'Response part 1 Response part 2'
      );
    });
  });

  describe('generateText request/response messages', () => {
    it('should handle generateText request.messages', () => {
      const request = {
        systemPrompt: 'System prompt',
      };

      const response = {
        request: {
          messages: [
            { role: 'user', content: 'Request user message' },
            { role: 'assistant', content: 'Request assistant message' },
          ],
        },
      };

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages?.length).toBe(3); // system + 2 from request.messages

      const userMessage = result.messages?.find(m => m.role === 'user');
      expect(userMessage?.content).toBe('Request user message');

      const assistantMessage = result.messages?.find(
        m => m.role === 'assistant'
      );
      expect(assistantMessage?.content).toBe('Request assistant message');
    });

    it('should handle generateText response.messages', () => {
      const request = {
        prompt: 'User prompt',
      };

      const response = {
        response: {
          messages: [
            { role: 'assistant', content: 'Response assistant message' },
          ],
        },
      };

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages?.length).toBe(2); // user + response.messages

      const assistantMessage = result.messages?.find(
        m => m.role === 'assistant'
      );
      expect(assistantMessage?.content).toBe('Response assistant message');
    });
  });

  describe('request handling', () => {
    it('should handle systemPrompt', () => {
      const request = {
        systemPrompt: 'You are a chatbot',
      };

      const response = {
        text: 'Hello',
      };

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      const systemMessage = result.messages?.find(m => m.role === 'system');
      expect(systemMessage?.content).toBe('You are a chatbot');
    });

    it('should handle prompt', () => {
      const request = {
        prompt: 'What is the meaning of life?',
      };

      const response = {
        text: '42',
      };

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      const userMessage = result.messages?.find(m => m.role === 'user');
      expect(userMessage?.content).toBe('What is the meaning of life?');
    });

    it('should handle both systemPrompt and prompt', () => {
      const request = {
        systemPrompt: 'Be helpful',
        prompt: 'Help me',
      };

      const response = {
        text: 'How can I help?',
      };

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages?.length).toBe(3);

      const systemMessage = result.messages?.find(m => m.role === 'system');
      expect(systemMessage?.content).toBe('Be helpful');

      const userMessage = result.messages?.find(m => m.role === 'user');
      expect(userMessage?.content).toBe('Help me');

      const assistantMessage = result.messages?.find(
        m => m.role === 'assistant'
      );
      expect(assistantMessage?.content).toBe('How can I help?');
    });
  });

  describe('array response handling', () => {
    it('should filter and join string items from array response', () => {
      const request = { prompt: 'Test' };
      const response = ['Hello', ' ', 'world', '!', 123, null, ''];

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response as any
      );

      expect(result.messages?.length).toBe(2);

      const assistantMessage = result.messages?.find(
        m => m.role === 'assistant'
      );
      expect(assistantMessage?.content).toBe('Hello world!');
    });

    it('should handle empty array response', () => {
      const request = { prompt: 'Test' };
      const response: any[] = [];

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages?.length).toBe(1); // Only user message
    });

    it('should handle array with no string items', () => {
      const request = { prompt: 'Test' };
      const response = [123, null, undefined, {}];

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages?.length).toBe(1); // Only user message
    });
  });

  describe('error handling', () => {
    it('should throw error when no messages found', () => {
      const request = {};
      const response = {};

      expect(() => {
        converter.convertToQualifireEvaluationRequest(request, response);
      }).toThrow('No messages found in the response');
    });

    it('should handle missing parts gracefully', () => {
      const request = { prompt: 'Test' };
      const response = {
        messages: [
          { role: 'user' }, // No content or parts
        ],
      };

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages?.length).toBe(2); // user from prompt + user from messages
      const messagesFromResponse = result.messages?.filter(
        m => m.content !== 'Test'
      );
      expect(messagesFromResponse?.[0]?.content).toBe(''); // Empty content for missing parts
    });
  });

  describe('edge cases', () => {
    it('should handle request with no recognizable prompt fields', () => {
      const request = { model: 'gpt-4' };
      const response = { text: 'Response' };

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages?.length).toBe(1); // Only assistant message
      expect(result.messages?.[0]?.role).toBe('assistant');
    });

    it('should prioritize different response types correctly', () => {
      const request = { prompt: 'Test' };
      const response = {
        text: 'Direct text',
        messages: [{ role: 'assistant', content: 'From messages' }],
        request: {
          messages: [{ role: 'assistant', content: 'From request.messages' }],
        },
      };

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      // Should include all types
      expect(result.messages?.length).toBe(4); // user + text + messages + request.messages
    });
  });
});
