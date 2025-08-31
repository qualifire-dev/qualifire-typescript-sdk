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

      expect(result).toEqual({
        messages: [
          {
            role: 'system',
            content: 'Talk like a pirate.',
          },
          {
            role: 'user',
            content: 'Are semicolons optional in JavaScript?',
          },
          {
            role: 'assistant',
            content:
              'Arrr matey! In JavaScript, semicolons be optional in most cases, but it be good practice to use them for clarity and to avoid potential issues with automatic semicolon insertion.',
          },
        ],
        available_tools: [
          {
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
          {
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
        ],
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

      expect(result).toEqual({
        messages: [
          {
            role: 'user',
            content: 'Write a one-sentence bedtime story about a unicorn.',
          },
          {
            role: 'assistant',
            content:
              'Once upon a moonlit night, a gentle unicorn with a silver mane danced through a starlit meadow, spreading magic and wonder to all who dreamed.',
          },
        ],
        available_tools: [],
      });
    });

    it('should handle responses API streaming with function call', async () => {
      const request = {
        instructions:
          'You are a helpful assistant that can answer questions about the weather.',
        input: 'What is the weather in Bogotá?',
        tools: [
          {
            type: 'function' as const,
            description: 'Get current temperature for a given location.',
            name: 'get_weather',
            parameters: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'The location to get weather for',
                },
              },
              required: ['location'],
              additionalProperties: false,
            },
            strict: true,
          },
        ],
      };

      // Mock streaming response chunks based on the provided data
      const streamingResponse = [
        {
          type: 'response.created',
          sequence_number: 0,
          response: {
            id: 'resp_68b3e03bf3e88196b97c138e6be2cc5807d57de666d08090',
            status: 'in_progress',
          },
        },
        {
          type: 'response.in_progress',
          sequence_number: 1,
        },
        {
          type: 'response.output_item.added',
          sequence_number: 2,
          output_index: 0,
          item: {
            id: 'fc_68b3e03cbed081968df2ff98fb115fdb07d57de666d08090',
            type: 'function_call',
            status: 'in_progress',
            arguments: '',
            call_id: 'call_ueAk3DyDXt9e3gTf7aZ9M67o',
            name: 'get_weather',
          },
        },
        {
          type: 'response.function_call_arguments.delta',
          sequence_number: 3,
          item_id: 'fc_68b3e03cbed081968df2ff98fb115fdb07d57de666d08090',
          output_index: 0,
          delta: '{"',
          obfuscation: 'qULbsPR3x7HMvo',
        },
        {
          type: 'response.function_call_arguments.delta',
          sequence_number: 4,
          item_id: 'fc_68b3e03cbed081968df2ff98fb115fdb07d57de666d08090',
          output_index: 0,
          delta: 'location',
          obfuscation: 'jJst8cmL',
        },
        {
          type: 'response.function_call_arguments.delta',
          sequence_number: 5,
          item_id: 'fc_68b3e03cbed081968df2ff98fb115fdb07d57de666d08090',
          output_index: 0,
          delta: '":"',
          obfuscation: 'dOHqbTQwV9zAf',
        },
        {
          type: 'response.function_call_arguments.delta',
          sequence_number: 6,
          item_id: 'fc_68b3e03cbed081968df2ff98fb115fdb07d57de666d08090',
          output_index: 0,
          delta: 'Bog',
          obfuscation: 'iDVbads4qt8qH',
        },
        {
          type: 'response.function_call_arguments.delta',
          sequence_number: 7,
          item_id: 'fc_68b3e03cbed081968df2ff98fb115fdb07d57de666d08090',
          output_index: 0,
          delta: 'otá',
          obfuscation: '0DoAtGfpP2HD7',
        },
        {
          type: 'response.function_call_arguments.delta',
          sequence_number: 8,
          item_id: 'fc_68b3e03cbed081968df2ff98fb115fdb07d57de666d08090',
          output_index: 0,
          delta: '"}',
          obfuscation: 'ScP7zkwfASpg19',
        },
        {
          type: 'response.function_call_arguments.done',
          sequence_number: 9,
          item_id: 'fc_68b3e03cbed081968df2ff98fb115fdb07d57de666d08090',
          output_index: 0,
          arguments: '{"location":"Bogotá"}',
        },
        {
          type: 'response.output_item.done',
          sequence_number: 10,
          output_index: 0,
          item: {
            id: 'fc_68b3e03cbed081968df2ff98fb115fdb07d57de666d08090',
            type: 'function_call',
            status: 'completed',
            arguments: '{"location":"Bogotá"}',
            call_id: 'call_ueAk3DyDXt9e3gTf7aZ9M67o',
            name: 'get_weather',
          },
        },
        {
          type: 'response.completed',
          sequence_number: 11,
          response: {
            id: 'resp_68b3e03bf3e88196b97c138e6be2cc5807d57de666d08090',
            status: 'completed',
            output: [
              {
                id: 'fc_68b3e03cbed081968df2ff98fb115fdb07d57de666d08090',
                type: 'function_call',
                status: 'completed',
                arguments: '{"location":"Bogotá"}',
                call_id: 'call_ueAk3DyDXt9e3gTf7aZ9M67o',
                name: 'get_weather',
              },
            ],
          },
        },
      ];

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        streamingResponse
      );

      expect(result).toEqual({
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that can answer questions about the weather.',
          },
          {
            role: 'user',
            content: 'What is the weather in Bogotá?',
          },
          {
            role: 'assistant',
            tool_calls: [
              {
                name: 'get_weather',
                arguments: {
                  location: 'Bogotá',
                },
                id: 'call_ueAk3DyDXt9e3gTf7aZ9M67o',
              },
            ],
          },
        ],
        available_tools: [
          {
            name: 'get_weather',
            description: 'Get current temperature for a given location.',
            parameters: {
              location: {
                type: 'string',
                description: 'The location to get weather for',
              },
            },
          },
        ],
      });
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

      expect(result).toEqual({
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
          {
            role: 'assistant',
            content: 'Hi there!',
          },
        ],
        available_tools: [],
      });
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

      expect(result).toEqual({
        messages: [
          {
            role: 'assistant',
            content: 'Response',
          },
        ],
        available_tools: [],
      });
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

      expect(result).toEqual({
        messages: [
          {
            role: 'user',
            content: 'Test',
          },
          {
            role: 'assistant',
            content: 'Response',
          },
        ],
        available_tools: [],
      });
    });
  });
});
