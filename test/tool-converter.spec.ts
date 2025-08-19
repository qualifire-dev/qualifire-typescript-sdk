import { convertToolsToLLMDefinitions } from '../src/frameworks/canonical';
import { LLMToolDefinitionSchema } from '../src/types';

describe('convertToolsToLLMDefinitions', () => {
  it('should convert OpenAI FunctionTool format', () => {
    const tools: unknown[] = [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get weather information for a location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'City name' },
            },
            required: ['location'],
          },
        },
      },
    ];

    const result = convertToolsToLLMDefinitions(tools);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'get_weather',
      description: 'Get weather information for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' },
        },
        required: ['location'],
      },
    });
  });

  it('should convert generic tool with name property', () => {
    const tools: unknown[] = [
      {
        name: 'calculator',
        description: 'Perform mathematical calculations',
        parameters: {
          operation: { type: 'string', enum: ['add', 'subtract'] },
          a: { type: 'number' },
          b: { type: 'number' },
        },
      },
    ];

    const result = convertToolsToLLMDefinitions(tools);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('calculator');
    expect(result[0].description).toBe('Perform mathematical calculations');
  });

  it('should handle Vercel AI SDK tool format with auto-generated name', () => {
    const tools: unknown[] = [
      {
        description: 'Search for information on the web',
        parameters: {
          query: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    ];

    const result = convertToolsToLLMDefinitions(tools);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('tool_0');
    expect(result[0].description).toBe('Search for information on the web');
  });

  it('should skip invalid tools and handle mixed formats', () => {
    const tools: unknown[] = [
      {
        name: 'valid_tool',
        description: 'A valid tool',
        parameters: {},
      },
      'invalid_string',
      null,
      undefined,
      { someProperty: 'invalid' },
    ];

    const result = convertToolsToLLMDefinitions(tools);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('valid_tool');
  });

  it('should provide default values for missing properties', () => {
    const tools: unknown[] = [
      {
        type: 'function',
        function: {
          name: 'minimal_tool',
          // No description or parameters
        },
      },
    ];

    const result = convertToolsToLLMDefinitions(tools);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'minimal_tool',
      description: 'No description provided',
      parameters: {},
    });
  });

  it('should validate output against schema', () => {
    const tools: unknown[] = [
      {
        name: 'test_tool',
        description: 'Test tool',
        parameters: { input: { type: 'string' } },
      },
    ];

    const result = convertToolsToLLMDefinitions(tools);
    const validation = LLMToolDefinitionSchema.safeParse(result[0]);

    expect(validation.success).toBe(true);
  });
});
