import { OpenAICanonicalEvaluationStrategy } from '../src/frameworks/openai/openai-converter';

describe('OpenAICanonicalEvaluationStrategy', () => {
  let converter: OpenAICanonicalEvaluationStrategy;

  beforeEach(() => {
    converter = new OpenAICanonicalEvaluationStrategy();
  });

  describe('chat completions API', () => {
    it('should convert OpenAI chat completions response', async () => {
      const request = {
        model: 'gpt-4o',
        messages: [
          { role: 'system' as const, content: 'Talk like a pirate.' },
          {
            role: 'user' as const,
            content: 'Are semicolons optional in JavaScript?',
          },
        ],
      };

      // Mock chat completions response
      const response = {
        choices: [
          {
            index: 0,
            message: { 
              role: 'assistant', 
              content: 'Arrr matey! In JavaScript, semicolons be optional in most cases, but it be good practice to use them for clarity and to avoid potential issues with automatic semicolon insertion.' 
            },
            finish_reason: 'stop',
          },
        ],
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages).toBeDefined();
      expect(result.messages?.length).toBe(3); // system, user, assistant

      // Should have system message
      const systemMessage = result.messages?.find(m => m.role === 'system');
      expect(systemMessage).toBeDefined();
      expect(systemMessage?.content).toBe('Talk like a pirate.');

      // Should have user message
      const userMessage = result.messages?.find(m => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage?.content).toBe(
        'Are semicolons optional in JavaScript?'
      );

      // Should have assistant message
      const assistantMessage = result.messages?.find(
        m => m.role === 'assistant'
      );
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toBeTruthy();
      expect(assistantMessage?.content).toContain('Arrr'); // Pirate language
      expect(assistantMessage?.content).toContain('semicolons'); // Response content
    });
  });

  describe('responses API', () => {
    it('should convert OpenAI responses API response', async () => {
      const request = {
        model: 'gpt-5',
        input: 'Write a one-sentence bedtime story about a unicorn.',
      };

      // Mock responses API response
      const response = {
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [
              { type: 'text', text: 'Once upon a moonlit night, a gentle unicorn with a silver mane danced through a starlit meadow, spreading magic and wonder to all who dreamed.' },
            ],
          },
        ],
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request as any,
        response
      );

      expect(result.messages).toBeDefined();
      expect(result.messages?.length).toBeGreaterThan(0);

      // Should have assistant message from output
      const assistantMessage = result.messages?.find(
        m => m.role === 'assistant'
      );
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toContain('unicorn'); // Story content
      expect(assistantMessage?.content).toContain('moonlit'); // Story content
    });
  });

  describe('message handling', () => {
    it('should handle multiple choices in chat completions', async () => {
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      const response = {
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hi there!' },
            finish_reason: 'stop',
          },
          {
            index: 1,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages?.length).toBe(3); // user + 2 assistant messages
      const assistantMessages = result.messages?.filter(
        m => m.role === 'assistant'
      );
      expect(assistantMessages?.length).toBe(2);
      expect(assistantMessages?.[0].content).toBe('Hi there!');
      expect(assistantMessages?.[1].content).toBe('Hello!');
    });

    it('should handle output with multiple elements', async () => {
      const request = { model: 'gpt-5' };

      const response = {
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [
              { type: 'text', text: 'First message' },
              { type: 'text', text: 'Second message' },
            ],
          },
        ],
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request as any,
        response
      );

      expect(result.messages?.length).toBe(2);
      expect(result.messages?.[0].content).toBe('First message');
      expect(result.messages?.[1].content).toBe('Second message');
    });
  });
  describe('edge cases', () => {
    it('should handle empty messages array', async () => {
      const request = { model: 'gpt-4', messages: [] };
      const response = {
        choices: [
          {
            message: { role: 'assistant', content: 'Response' },
          },
        ],
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );
      expect(result.messages?.length).toBe(1);
      expect(result.messages?.[0].role).toBe('assistant');
    });

    it('should handle missing optional fields', async () => {
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Test' }],
      };

      const response = {
        choices: [
          {
            message: { role: 'assistant', content: 'Response' },
            // Missing index, finish_reason
          },
        ],
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );
      expect(result.messages?.length).toBe(2);
    });
  });
});
