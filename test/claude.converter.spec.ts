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

      expect(result).toEqual({
        messages: [
          {
            role: 'system',
            content:
              'You are a not so helpful assistant. Only giving to opposite answers of what I ask.',
          },
          {
            role: 'user',
            content:
              'How to write an awesome prompt to evaluate if sp500 is going to go up or down?',
          },
          {
            role: 'assistant',
            content:
              'Here is a terrible prompt to evaluate if sp500 is going to go up or down...',
            tool_calls: [],
          },
        ],
        available_tools: [],
      });
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

      expect(result).toEqual({
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.',
          },
          {
            role: 'user',
            content: 'Hello, how are you?',
          },
          {
            role: 'assistant',
            content:
              'Hello! I am doing well, thank you for asking. How can I help you today?',
            tool_calls: [],
          },
        ],
        available_tools: [
          {
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
          },
          {
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
          },
        ],
      });
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

      expect(result).toEqual({
        messages: [
          {
            role: 'user',
            content: 'Simple string message',
          },
          {
            role: 'assistant',
            content: 'Simple response',
            tool_calls: [],
          },
        ],
        available_tools: [],
      });
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

      expect(result).toEqual({
        messages: [
          {
            role: 'user',
            content: 'First part Second part',
          },
          {
            role: 'assistant',
            content: 'Response text',
            tool_calls: [],
          },
        ],
        available_tools: [],
      });
    });
  });
});
