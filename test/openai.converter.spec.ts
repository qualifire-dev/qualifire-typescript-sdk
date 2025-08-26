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
        tools: [
          {
            type: 'function' as const,
            function: {
              name: 'get_weather',
              description: 'Get the current weather for a location',
              parameters: {
                type: 'object',
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
          },
          {
            type: 'function' as const,
            function: {
              name: 'calculate_tip',
              description: 'Calculate tip amount for a bill',
              parameters: {
                type: 'object',
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
              content:
                'Arrr matey! In JavaScript, semicolons be optional in most cases, but it be good practice to use them for clarity and to avoid potential issues with automatic semicolon insertion.',
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
      expect(result.messages?.[0]?.role).toBe('system');
      expect(result.messages?.[0]?.content).toBe('Talk like a pirate.');

      // Should have user message
      expect(result.messages?.[1]?.role).toBe('user');
      expect(result.messages?.[1]?.content).toBe(
        'Are semicolons optional in JavaScript?'
      );

      // Should have assistant message
      expect(result.messages?.[2]?.role).toBe('assistant');
      expect(result.messages?.[2]?.content).toContain(
        'Arrr matey! In JavaScript, semicolons be optional in most cases, but it be good practice to use them for clarity and to avoid potential issues with automatic semicolon insertion.'
      );

      // Verify tools are properly included
      expect(result.available_tools).toBeDefined();
      expect(result.available_tools).toHaveLength(2);

      // Verify first tool (get_weather)
      expect(result.available_tools?.[0]).toEqual({
        name: 'get_weather',
        description: 'Get the current weather for a location',
        parameters: {
          type: 'object',
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
      });

      // Verify second tool (calculate_tip)
      expect(result.available_tools?.[1]).toEqual({
        name: 'calculate_tip',
        description: 'Calculate tip amount for a bill',
        parameters: {
          type: 'object',
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
      });
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
              {
                type: 'text',
                text:
                  'Once upon a moonlit night, a gentle unicorn with a silver mane danced through a starlit meadow, spreading magic and wonder to all who dreamed.',
              },
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

      // Should have user message from input
      expect(result.messages?.[0]?.role).toBe('user');
      expect(result.messages?.[0]?.content).toBe(
        'Write a one-sentence bedtime story about a unicorn.'
      );

      // Should have assistant message from output
      expect(result.messages?.[1]?.role).toBe('assistant');
      expect(result.messages?.[1]?.content).toContain('unicorn'); // Story content
      expect(result.messages?.[1]?.content).toContain('moonlit'); // Story content
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

      expect(result.messages?.length).toBe(2); // user + 1 assistant messages
      expect(result.messages?.[0]?.role).toBe('user');
      expect(result.messages?.[1]?.role).toBe('assistant');
      expect(result.messages?.[1]?.content).toBe('Hi there!');
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
