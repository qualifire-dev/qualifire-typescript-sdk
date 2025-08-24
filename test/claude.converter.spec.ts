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

      // Mock streaming response data as a list containing different parts
      const response = [
        {
          type: 'message_start',
          message: {
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text:
                  'Here is a terrible prompt to evaluate if sp500 is going to go up or down...',
              },
            ],
          },
        },
        {
          type: 'content_block_start',
          content_block: {
            type: 'text',
            text: '',
          },
        },
        {
          type: 'content_block_delta',
          delta: {
            type: 'text_delta',
            text: 'Here is a terrible prompt',
          },
        },
        {
          type: 'content_block_delta',
          delta: {
            type: 'text_delta',
            text: ' to evaluate if sp500 is going to go up or down...',
          },
        },
        {
          type: 'content_block_stop',
        },
        {
          type: 'message_delta',
          delta: {
            stop_reason: 'end_turn',
          },
        },
        {
          type: 'message_stop',
        },
      ];

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
      expect(assistantMessage?.content).toContain(
        'Here is a terrible prompt to evaluate if sp500 '
      ); // Content from the response
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
        tools: [
          {
            name: 'get_weather',
            description: 'Get the current weather for a location',
            input_schema: {
              properties: {
                location: {
                  type: 'string',
                  description: 'The city and state, e.g. San Francisco, CA',
                },
                unit: {
                  type: 'string',
                  enum: ['celsius', 'fahrenheit'],
                },
              },
              required: ['location'],
            },
          },
          {
            name: 'calculate_tip',
            description: 'Calculate tip amount for a bill',
            input_schema: {
              properties: {
                bill_amount: {
                  type: 'number',
                  description: 'The bill amount',
                },
                tip_percentage: {
                  type: 'number',
                  description: 'The tip percentage (e.g., 15 for 15%)',
                },
              },
              required: ['bill_amount', 'tip_percentage'],
            },
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
            text:
              'Hello! I am doing well, thank you for asking. How can I help you today?',
          },
        ],
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages).toBeDefined();
      expect(result.messages?.[0]?.role).toBe('system');
      expect(result.messages?.[0]?.content).toBe(
        'You are a helpful assistant.'
      );

      expect(result.messages?.[1]?.role).toBe('user');
      expect(result.messages?.[1]?.content).toBe('Hello, how are you?');

      expect(result.messages?.[2]?.role).toBe('assistant');
      expect(result.messages?.[2]?.content).toBe(
        'Hello! I am doing well, thank you for asking. How can I help you today?'
      );
      expect(result.messages?.length).toBe(3); // system, user, assistant

      // Verify tools are properly included
      expect(result.available_tools).toBeDefined();

      // Verify first tool (get_weather)
      expect(result.available_tools?.[0]).toEqual({
        name: 'get_weather',
        description: 'Get the current weather for a location',
        parameters: {
          location: {
            type: 'string',
            description: 'The city and state, e.g. San Francisco, CA',
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
          },
        },
      });

      // Verify second tool (calculate_tip)
      expect(result.available_tools?.[1]).toEqual({
        name: 'calculate_tip',
        description: 'Calculate tip amount for a bill',
        parameters: {
          bill_amount: {
            type: 'number',
            description: 'The bill amount',
          },
          tip_percentage: {
            type: 'number',
            description: 'The tip percentage (e.g., 15 for 15%)',
          },
        },
      });
      expect(result.available_tools).toHaveLength(2);
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
  });
});
