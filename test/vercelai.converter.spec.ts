import { VercelAICanonicalEvaluationStrategy } from '../src/frameworks/vercelai/vercelai-converter';
import { ReadableStream } from 'stream/web';

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
      const mockTextStream = new ReadableStream({
        start(controller) {
          controller.enqueue('Yes, the sky is blue.');
          controller.enqueue(' It appears blue due to Rayleigh scattering.');
          controller.close();
        },
      });

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

      // Should have system, user, and 2 assistant messages (content + tool calls)
      expect(result.messages?.length).toBe(4);

      // Should have system message
      expect(result.messages?.[0]?.role).toBe('system');
      expect(result.messages?.[0]?.content).toBe(
        'You are a helpful assistant.'
      );

      // Should have user message
      expect(result.messages?.[1]?.role).toBe('user');
      expect(result.messages?.[1]?.content).toBe('Are the sky blue?');

      // Should have assistant message with accumulated stream content
      expect(result.messages?.[2]?.role).toBe('assistant');
      expect(result.messages?.[2]?.content).toBe(
        'Yes, the sky is blue. It appears blue due to Rayleigh scattering.'
      );

      // Should have assistant message with tool calls
      expect(result.messages?.[3]?.role).toBe('assistant');
      expect(result.messages?.[3]?.tool_calls).toBeDefined();
      expect(result.messages?.[3]?.tool_calls?.length).toBe(1);
      expect(result.messages?.[3]?.tool_calls?.[0]?.name).toBe('weather_tool');
      expect(result.messages?.[3]?.tool_calls?.[0]?.arguments).toEqual({
        location: 'sky',
        query: 'color',
      });
      expect(result.messages?.[3]?.tool_calls?.[0]?.id).toBe('call-123');
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
      const mockTextStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            "The sky often appears blue during the daytime because of the way Earth's atmosphere scatters sunlight. "
          );
          controller.enqueue(
            'When sunlight enters the atmosphere, shorter wavelengths of light (blue and violet) are scattered more than longer wavelengths (red and yellow). '
          );
          controller.enqueue(
            'Our eyes are more sensitive to blue light, so we see the sky as blue. '
          );
          controller.enqueue(
            'However, the color of the sky can change based on weather, time of day, and other atmospheric conditions—for example, it might look orange or red at sunrise or sunset, or gray on a cloudy day.'
          );
          controller.close();
        },
      });

      const response = {
        textStream: mockTextStream,
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      // Should have system, user, and assistant messages
      expect(result.messages?.length).toBe(3);

      // Should have system message
      expect(result.messages?.[0]?.role).toBe('system');
      expect(result.messages?.[0]?.content).toBe(
        'You are a smart assistant that uses tools to answer questions'
      );

      // Should have user message
      expect(result.messages?.[1]?.role).toBe('user');
      expect(result.messages?.[1]?.content).toBe(
        'What is the weather in antartica'
      );

      // Should have assistant message with accumulated stream content
      expect(result.messages?.[2]?.role).toBe('assistant');
      expect(result.messages?.[2]?.content).toBe(
        "The sky often appears blue during the daytime because of the way Earth's atmosphere scatters sunlight. When sunlight enters the atmosphere, shorter wavelengths of light (blue and violet) are scattered more than longer wavelengths (red and yellow). Our eyes are more sensitive to blue light, so we see the sky as blue. However, the color of the sky can change based on weather, time of day, and other atmospheric conditions—for example, it might look orange or red at sunrise or sunset, or gray on a cloudy day."
      );

      // Should have available tools
      expect(result.available_tools).toBeDefined();
      expect(result.available_tools?.length).toBe(1);
      expect(result.available_tools?.[0]?.name).toBe('weather');
      expect(result.available_tools?.[0]?.description).toBe(
        'Get the weather in a location'
      );
      expect(result.available_tools?.[0]?.parameters?.location?.type).toBe(
        'string'
      );
      expect(
        result.available_tools?.[0]?.parameters?.location?.description
      ).toBe('The location to get the weather for');
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

      // Should have system, user, and 2 tool-related messages
      expect(result.messages?.length).toBe(4);

      // Should have system message
      expect(result.messages?.[0]?.role).toBe('system');
      expect(result.messages?.[0]?.content).toBe(
        'You are a helpful assistant that can use tools.'
      );

      // Should have user message
      expect(result.messages?.[1]?.role).toBe('user');
      expect(result.messages?.[1]?.content).toBe(
        'What is the weather in Antarctica?'
      );

      // Should have assistant message with tool-call
      expect(result.messages?.[2]?.role).toBe('assistant');
      expect(result.messages?.[2]?.tool_calls).toBeDefined();
      expect(result.messages?.[2]?.tool_calls?.length).toBe(1);
      expect(result.messages?.[2]?.tool_calls?.[0]?.name).toBe('weather');
      expect(result.messages?.[2]?.tool_calls?.[0]?.arguments).toEqual({
        location: 'Antarctica',
      });
      expect(result.messages?.[2]?.tool_calls?.[0]?.id).toBe(
        'call_N4fi1B1aOpk0VnxGDn4HT9jX'
      );

      // Should have tool message with tool-result
      expect(result.messages?.[3]?.role).toBe('tool');
      expect(result.messages?.[3]?.content).toBe(
        '{"location":"Antarctica","temperature":65}'
      );
      expect(result.messages?.[3]?.tool_calls).toBeDefined();
      expect(result.messages?.[3]?.tool_calls?.length).toBe(1);
      expect(result.messages?.[3]?.tool_calls?.[0]?.name).toBe('weather');
      expect(result.messages?.[3]?.tool_calls?.[0]?.arguments).toEqual({
        location: 'Antarctica',
      });
      expect(result.messages?.[3]?.tool_calls?.[0]?.id).toBe(
        'call_N4fi1B1aOpk0VnxGDn4HT9jX'
      );

      // Should have available tools
      expect(result.available_tools).toBeDefined();
      expect(result.available_tools?.length).toBe(1);
      expect(result.available_tools?.[0]?.name).toBe('weather');
    });
  });
});
