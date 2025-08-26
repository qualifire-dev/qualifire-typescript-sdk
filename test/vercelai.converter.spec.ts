import { VercelAICanonicalEvaluationStrategy } from '../src/frameworks/vercelai/vercelai-converter';

describe('VercelAICanonicalEvaluationStrategy', () => {
  let converter: VercelAICanonicalEvaluationStrategy;

  beforeEach(() => {
    converter = new VercelAICanonicalEvaluationStrategy();
  });

  describe('streaming response with textStream and toolCalls', () => {
    it('should convert Vercel AI streaming response to accumulated content', async () => {
      const request = {
        system: 'You are a helpful assistant.',
        prompt: 'Are the sky blue?',
      };

      // Create a mock ReadableStream for textStream
      const mockAsyncIterable = {
        [Symbol.asyncIterator]: async function* () {
          yield 'Yes, the sky is blue.';
          yield ' It appears blue due to Rayleigh scattering.';
        },
      };

      const mockTextStream = {
        tee: () => [mockAsyncIterable, mockAsyncIterable],
      };

      // Create a mock promise for toolCalls
      const mockToolCalls = Promise.resolve([
        {
          toolName: 'weather_tool',
          input: { location: 'sky', query: 'color' },
          toolCallId: 'call-123',
        },
      ]);

      const response = {
        textStream: mockTextStream,
        toolCalls: mockToolCalls,
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
            content: 'Are the sky blue?',
          },
          {
            role: 'assistant',
            content:
              'Yes, the sky is blue. It appears blue due to Rayleigh scattering.',
          },
          {
            role: 'assistant',
            tool_calls: [
              {
                name: 'weather_tool',
                arguments: {
                  location: 'sky',
                  query: 'color',
                },
                id: 'call-123',
              },
            ],
          },
        ],
        available_tools: [],
      });
    });

    it('should convert Vercel AI text generation response using inline data', async () => {
      const request = {
        system: 'You are a smart assistant that uses tools to answer questions',
        prompt: 'What is the weather in antartica',
        tools: {
          weather: {
            description: 'Get the weather in a location',
            inputSchema: {
              jsonSchema: {
                properties: {
                  location: {
                    type: 'string',
                    description: 'The location to get the weather for',
                  },
                },
              },
            },
          },
        },
      };

      // Create a mock ReadableStream for textStream
      const mockAsyncIterable = {
        [Symbol.asyncIterator]: async function* () {
          yield "The sky often appears blue during the daytime because of the way Earth's atmosphere scatters sunlight. ";
          yield 'When sunlight enters the atmosphere, shorter wavelengths of light (blue and violet) are scattered more than longer wavelengths (red and yellow). ';
          yield 'Our eyes are more sensitive to blue light, so we see the sky as blue. ';
          yield 'However, the color of the sky can change based on weather, time of day, and other atmospheric conditions—for example, it might look orange or red at sunrise or sunset, or gray on a cloudy day.';
        },
      };

      const mockTextStream = {
        tee: () => [mockAsyncIterable, mockAsyncIterable],
      };

      const response = {
        textStream: mockTextStream,
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result).toEqual({
        messages: [
          {
            role: 'system',
            content:
              'You are a smart assistant that uses tools to answer questions',
          },
          {
            role: 'user',
            content: 'What is the weather in antartica',
          },
          {
            role: 'assistant',
            content:
              "The sky often appears blue during the daytime because of the way Earth's atmosphere scatters sunlight. When sunlight enters the atmosphere, shorter wavelengths of light (blue and violet) are scattered more than longer wavelengths (red and yellow). Our eyes are more sensitive to blue light, so we see the sky as blue. However, the color of the sky can change based on weather, time of day, and other atmospheric conditions—for example, it might look orange or red at sunrise or sunset, or gray on a cloudy day.",
          },
        ],
        available_tools: [
          {
            name: 'weather',
            description: 'Get the weather in a location',
            parameters: {
              location: {
                type: 'string',
                description: 'The location to get the weather for',
              },
            },
          },
        ],
      });
    });

    it('should handle non-streaming response with tool-call and tool-result', async () => {
      const request = {
        system: 'You are a helpful assistant that can use tools.',
        prompt: 'What is the weather in Antarctica?',
        tools: {
          weather: {
            description: 'Get the weather in a location',
            inputSchema: {
              jsonSchema: {
                properties: {
                  location: { type: 'string' },
                },
                required: ['location'],
              },
            },
          },
        },
      };

      const response = {
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_N4fi1B1aOpk0VnxGDn4HT9jX',
                toolName: 'weather',
                input: { location: 'Antarctica' },
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_N4fi1B1aOpk0VnxGDn4HT9jX',
                toolName: 'weather',
                input: { location: 'Antarctica' },
                output: { location: 'Antarctica', temperature: 65 },
              },
            ],
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
            content: 'You are a helpful assistant that can use tools.',
          },
          {
            role: 'user',
            content: 'What is the weather in Antarctica?',
          },
          {
            role: 'assistant',
            tool_calls: [
              {
                name: 'weather',
                arguments: {
                  location: 'Antarctica',
                },
                id: 'call_N4fi1B1aOpk0VnxGDn4HT9jX',
              },
            ],
          },
          {
            role: 'tool',
            content: '{"location":"Antarctica","temperature":65}',
            tool_calls: [
              {
                name: 'weather',
                arguments: {
                  location: 'Antarctica',
                },
                id: 'call_N4fi1B1aOpk0VnxGDn4HT9jX',
              },
            ],
          },
        ],
        available_tools: [
          {
            name: 'weather',
            description: 'Get the weather in a location',
            parameters: {
              location: {
                type: 'string',
              },
            },
          },
        ],
      });
    });
  });
});
