import { ClaudeCanonicalEvaluationStrategy } from '../src/frameworks/claude/claude-converter';

describe('ClaudeCanonicalEvaluationStrategy', () => {
  let converter: ClaudeCanonicalEvaluationStrategy;

  beforeEach(() => {
    converter = new ClaudeCanonicalEvaluationStrategy();
  });

  describe('streaming response', () => {
    it('should convert Claude streaming chunks to accumulated content', async () => {
      const request = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system:
          'You are a not so helpful assistant. Only giving to opposite answers of what I ask.',
        messages: [
          {
            role: 'user' as const,
            content:
              'How to write an awesome prompt to evaluate if sp500 is going to go up or down?',
          },
        ],
      };

      // Mock streaming response data
      const response = {
        type: 'message_start',
        message: {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Here is a terrible prompt to evaluate if sp500 is going to go up or down...'
            }
          ]
        }
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
      expect(systemMessage?.content).toBe(
        'You are a not so helpful assistant. Only giving to opposite answers of what I ask.'
      );

      // Should have user message
      const userMessage = result.messages?.find(m => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage?.content).toBe(
        'How to write an awesome prompt to evaluate if sp500 is going to go up or down?'
      );

      // Should have assistant message
      const assistantMessage = result.messages?.find(
        m => m.role === 'assistant'
      );
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toBeTruthy();
      expect(assistantMessage?.content).toContain('terrible prompt'); // Content from the response
    });
  });

  describe('non-streaming response', () => {
    it('should convert Claude non-streaming response', async () => {
      const request = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: 'You are a helpful assistant.',
        messages: [
          {
            role: 'user' as const,
            content: 'Hello, how are you?',
          },
        ],
      };

      // Mock non-streaming response data
      const response = {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Hello! I am doing well, thank you for asking. How can I help you today?'
          }
        ]
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

      // Should have user message
      const userMessage = result.messages?.find(m => m.role === 'user');
      expect(userMessage).toBeDefined();

      // Should have assistant message
      const assistantMessage = result.messages?.find(
        m => m.role === 'assistant'
      );
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toBeTruthy();
    });
  });

  describe('message content handling', () => {
    it('should handle string content', async () => {
      const request = {
        model: 'claude-3',
        messages: [
          {
            role: 'user' as const,
            content: 'Simple string message',
          },
        ],
      };

      const response = {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Simple response',
          },
        ],
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      const userMessage = result.messages?.find(m => m.role === 'user');
      expect(userMessage?.content).toBe('Simple string message');

      const assistantMessage = result.messages?.find(
        m => m.role === 'assistant'
      );
      expect(assistantMessage?.content).toBe('Simple response');
    });

    it('should handle array content', async () => {
      const request = {
        model: 'claude-3',
        messages: [
          {
            role: 'user' as const,
            content: 'First part Second part',
          },
        ],
      };

      const response = {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Response text',
          },
        ],
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      const userMessage = result.messages?.find(m => m.role === 'user');
      expect(userMessage?.content).toBe('First part Second part');
    });

    it('should handle tool_use content', async () => {
      const request = {
        model: 'claude-3',
        messages: [{ role: 'user' as const, content: 'Use a tool' }],
      };

      const response = {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            name: 'calculator',
            input: { operation: 'add', numbers: [1, 2] },
            id: 'tool-123'
          },
        ],
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      const assistantMessage = result.messages?.find(
        m => m.role === 'assistant'
      );
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.tool_calls).toBeDefined();
      expect(assistantMessage?.tool_calls?.[0]?.name).toBe('calculator');
    });
  });
});
