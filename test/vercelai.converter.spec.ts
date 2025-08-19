import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { VercelAICanonicalEvaluationStrategy } from '../src/frameworks/vercelai/vercelaiconverter';

describe('VercelAICanonicalEvaluationStrategy', () => {
  let converter: VercelAICanonicalEvaluationStrategy;

  beforeEach(() => {
    converter = new VercelAICanonicalEvaluationStrategy();
  });

  describe('streaming response (array of strings)', () => {
    it('should convert Vercel AI streaming response to accumulated content', async () => {
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

      const result = await converter.convertToQualifireEvaluationRequest(
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
    it('should handle generateText response with text property', async () => {
      const request = {
        model: 'gpt-4',
        prompt: 'What is AI?',
      };

      const response = {
        text: 'AI stands for Artificial Intelligence.',
      };

      const result = await converter.convertToQualifireEvaluationRequest(
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
    it('should handle useChat messages with string content', async () => {
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

      const result = await converter.convertToQualifireEvaluationRequest(
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

    it('should handle useChat messages with parts content', async () => {
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

      const result = await converter.convertToQualifireEvaluationRequest(
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
    it('should throw error when no messages found', async () => {
      const request = {};
      const response = {};

      await expect(async () => {
        await converter.convertToQualifireEvaluationRequest(request, response);
      }).rejects.toThrow('No messages found in the response');
    });

    it('should handle missing parts gracefully', async () => {
      const request = { prompt: 'Test' };
      const response = {
        messages: [
          { role: 'user' }, // No content or parts
        ],
      };

      const result = await converter.convertToQualifireEvaluationRequest(
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
    it('should handle request with no recognizable prompt fields', async () => {
      const request = { model: 'gpt-4' };
      const response = { text: 'Response' };

      const result = await converter.convertToQualifireEvaluationRequest(
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

  describe('tools and tool calls', () => {
    it('should handle request with tools and response with toolCalls', () => {
      const request = {
        prompt: "What is love?",
        system: "You are an assistant which tells lies",
        tools: {
          tool1: {
            description: "Tool 1",
            inputSchema: {
              type: "object",
              properties: {
                value: {
                  type: "string",
                  description: "The value to be used in the tool"
                }
              },
              required: ["value"]
            }
          }
        }
      };

      const response = {
        toolCalls: [
          {
            "input": {
              "value": "value",
            },
            "providerExecuted": undefined,
            "providerMetadata": undefined,
            "toolCallId": "call-1",
            "toolName": "tool1",
            "type": "tool-call",
          },
        ]
      };

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      // Should have system and user messages plus assistant message with tool call
      expect(result.messages?.length).toBe(3);

      // Should have system message
      const systemMessage = result.messages?.find(m => m.role === 'system');
      expect(systemMessage).toBeDefined();
      expect(systemMessage?.content).toBe('You are an assistant which tells lies');

      // Should have user message
      const userMessage = result.messages?.find(m => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage?.content).toBe('What is love?');

      // Should have assistant message with tool calls
      const assistantMessage = result.messages?.find(m => m.role === 'assistant');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.tool_calls).toBeDefined();
      expect(assistantMessage?.tool_calls?.length).toBe(1);
      expect(assistantMessage?.tool_calls?.[0]?.name).toBe('tool1');
      expect(assistantMessage?.tool_calls?.[0]?.arguments).toEqual({ value: "value" });
      expect(assistantMessage?.tool_calls?.[0]?.id).toBe('call-1');

      // Should have available tools
      expect(result.available_tools).toBeDefined();
      expect(result.available_tools?.length).toBe(1);
      expect(result.available_tools?.[0]?.name).toBe('tool1');
      expect(result.available_tools?.[0]?.description).toBe('Tool 1');

    });

    it('should handle multiple tool calls', () => {
      const request = {
        prompt: "Use multiple tools",
        tools: {
          tool1: {
            description: "First tool",
            inputSchema: {
              type: "object",
              properties: {
                param1: { type: "string" }
              }
            }
          },
          tool2: {
            description: "Second tool",
            inputSchema: {
              type: "object",
              properties: {
                param2: { type: "number" }
              }
            }
          }
        }
      };

      const response = {
        toolCalls: [
          {
            "input": { "param1": "test" },
            "toolCallId": "call-1",
            "toolName": "tool1",
            "type": "tool-call"
          },
          {
            "input": { "param2": 42 },
            "toolCallId": "call-2",
            "toolName": "tool2",
            "type": "tool-call"
          }
        ]
      };

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      // Should have user message plus 2 assistant messages with tool calls
      expect(result.messages?.length).toBe(3);

      // Should have 2 assistant messages with tool calls
      const assistantMessages = result.messages?.filter(m => m.role === 'assistant');
      expect(assistantMessages?.length).toBe(2);
      
      const toolCallMessages = assistantMessages?.filter(m => m.tool_calls);
      expect(toolCallMessages?.length).toBe(2);

      // Check first tool call
      const firstToolCall = toolCallMessages?.[0]?.tool_calls?.[0];
      expect(firstToolCall?.name).toBe('tool1');
      expect(firstToolCall?.arguments).toEqual({ param1: "test" });
      expect(firstToolCall?.id).toBe('call-1');

      // Check second tool call
      const secondToolCall = toolCallMessages?.[1]?.tool_calls?.[0];
      expect(secondToolCall?.name).toBe('tool2');
      expect(secondToolCall?.arguments).toEqual({ param2: 42 });
      expect(secondToolCall?.id).toBe('call-2');

      // Should have 2 available tools
      expect(result.available_tools?.length).toBe(2);
      expect(result.available_tools?.find(t => t.name === 'tool1')).toBeDefined();
      expect(result.available_tools?.find(t => t.name === 'tool2')).toBeDefined();
    });

    it('should handle tools in request without tool calls in response', async () => {
      const request = {
        prompt: "Question without tool use",
        tools: {
          unused_tool: {
            description: "This tool won't be called"
          }
        }
      };

      const response = {
        text: "Regular response without tool calls"
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      // Should have user and assistant messages
      expect(result.messages?.length).toBe(2);

      // No tool calls should be present
      const assistantMessage = result.messages?.find(m => m.role === 'assistant');
      expect(assistantMessage?.tool_calls).toBeUndefined();
      expect(assistantMessage?.content).toBe("Regular response without tool calls");

      // Should still have available tools
      expect(result.available_tools?.length).toBe(1);
      expect(result.available_tools?.[0]?.name).toBe('unused_tool');
    });

    it('should correctly extract parameters from Zod schema inputSchema', async () => {
      const request = {
        prompt: "Use tool with Zod schema",
        tools: {
          zod_tool: {
            description: "Tool with Zod schema",
            inputSchema: z.object({
              name: z.string().describe("User's name"),
              age: z.number().min(0).describe("User's age"),
              email: z.string().email().optional().describe("User's email")
            })
          }
        }
      };

      const response = {
        text: "Tool parameters extracted"
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      // Should have available tools with parameters
      expect(result.available_tools?.length).toBe(1);
      const tool = result.available_tools?.[0];
      expect(tool?.name).toBe('zod_tool');
      expect(tool?.description).toBe('Tool with Zod schema');
      
      // Should have parameters extracted from Zod schema
      expect(tool?.parameters).toBeDefined();
      expect(tool?.parameters?.name).toBeDefined();
      expect(tool?.parameters?.age).toBeDefined();
      expect(tool?.parameters?.email).toBeDefined();
      
      // Check parameter details
      expect(tool?.parameters?.name?.type).toBe('string');
      expect(tool?.parameters?.name?.description).toBe("User's name");
      expect(tool?.parameters?.age?.type).toBe('number');
      expect(tool?.parameters?.age?.description).toBe("User's age");
      expect(tool?.parameters?.email?.type).toBe('string');
      expect(tool?.parameters?.email?.description).toBe("User's email");
    });

    it('should correctly extract parameters from JSONSchema inputSchema', async () => {
      const request = {
        prompt: "Use tool with JSONSchema",
        tools: {
          json_tool: {
            description: "Tool with JSONSchema",
            inputSchema: {
              jsonSchema: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description: "Search query",
                  minLength: 1
                  },
                  limit: {
                    type: "integer",
                    description: "Maximum results",
                    minimum: 1,
                    maximum: 100
                  },
                  filters: {
                    type: "array",
                    description: "Search filters",
                    items: {
                      type: "string"
                    }
                  }
                },
                required: ["query"]
              }
            }
          }
        }
      };

      const response = {
        text: "JSONSchema parameters extracted"
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      // Should have available tools with parameters
      expect(result.available_tools?.length).toBe(1);
      const tool = result.available_tools?.[0];
      expect(tool?.name).toBe('json_tool');
      expect(tool?.description).toBe('Tool with JSONSchema');
      
      // Should have parameters extracted from JSONSchema
      expect(tool?.parameters).toBeDefined();
      expect(tool?.parameters?.query).toBeDefined();
      expect(tool?.parameters?.limit).toBeDefined();
      expect(tool?.parameters?.filters).toBeDefined();
      
      // Check parameter details
      expect(tool?.parameters?.query?.type).toBe('string');
      expect(tool?.parameters?.query?.description).toBe('Search query');
      expect(tool?.parameters?.query?.minLength).toBe(1);
      
      expect(tool?.parameters?.limit?.type).toBe('integer');
      expect(tool?.parameters?.limit?.description).toBe('Maximum results');
      expect(tool?.parameters?.limit?.minimum).toBe(1);
      expect(tool?.parameters?.limit?.maximum).toBe(100);
      
      expect(tool?.parameters?.filters?.type).toBe('array');
      expect(tool?.parameters?.filters?.description).toBe('Search filters');
      expect(tool?.parameters?.filters?.items?.type).toBe('string');
    });

    it('should handle tools with missing inputSchema', () => {
      const request = {
        prompt: "Use tool without schema",
        tools: {
          no_schema_tool: {
            description: "Tool without input schema"
          }
        }
      };

      const response = {
        text: "No schema tool used"
      };

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      // Should have available tools
      expect(result.available_tools?.length).toBe(1);
      const tool = result.available_tools?.[0];
      expect(tool?.name).toBe('no_schema_tool');
      expect(tool?.description).toBe('Tool without input schema');
      
      // Should have empty parameters object
      expect(tool?.parameters).toEqual({});
    });

    it('should handle tools with malformed inputSchema', () => {
      const request = {
        prompt: "Use tool with malformed schema",
        tools: {
          malformed_tool: {
            description: "Tool with malformed schema",
            inputSchema: {
              // Missing jsonSchema property
              properties: {
                test: { type: "string" }
              }
            }
          }
        }
      };

      const response = {
        text: "Malformed schema tool used"
      };

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      // Should have available tools
      expect(result.available_tools?.length).toBe(1);
      const tool = result.available_tools?.[0];
      expect(tool?.name).toBe('malformed_tool');
      expect(tool?.description).toBe('Tool with malformed schema');
      
      // Should have empty parameters object due to malformed schema
      expect(tool?.parameters).toEqual({});
    });

    it('should handle tools with complex nested Zod schemas', () => {
      const request = {
        prompt: "Use tool with complex Zod schema",
        tools: {
          complex_tool: {
            description: "Tool with complex nested schema",
            inputSchema: z.object({
              user: z.object({
                profile: z.object({
                  firstName: z.string(),
                  lastName: z.string(),
                  preferences: z.object({
                    theme: z.enum(['light', 'dark']),
                    notifications: z.boolean()
                  }).optional()
                }),
                settings: z.array(z.object({
                  key: z.string(),
                  value: z.union([z.string(), z.number(), z.boolean()])
                }))
              }),
              metadata: z.record(z.string(), z.any()).optional()
            })
          }
        }
      };

      const response = {
        text: "Complex schema tool used"
      };

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      // Should have available tools with complex parameters
      expect(result.available_tools?.length).toBe(1);
      const tool = result.available_tools?.[0];
      expect(tool?.name).toBe('complex_tool');
      expect(tool?.description).toBe('Tool with complex nested schema');
      
      // Should have complex parameters structure
      expect(tool?.parameters).toBeDefined();
      expect(tool?.parameters?.user).toBeDefined();
      expect(tool?.parameters?.user?.profile).toBeDefined();
      expect(tool?.parameters?.user?.profile?.firstName).toBeDefined();
      expect(tool?.parameters?.user?.profile?.lastName).toBeDefined();
      expect(tool?.parameters?.user?.profile?.preferences).toBeDefined();
      expect(tool?.parameters?.user?.profile?.preferences?.theme).toBeDefined();
      expect(tool?.parameters?.user?.profile?.preferences?.notifications).toBeDefined();
      expect(tool?.parameters?.user?.settings).toBeDefined();
      expect(tool?.parameters?.metadata).toBeDefined();
      
      // Check specific parameter types
      expect(tool?.parameters?.user?.profile?.firstName?.type).toBe('string');
      expect(tool?.parameters?.user?.profile?.preferences?.theme?.enum).toEqual(['light', 'dark']);
      expect(tool?.parameters?.user?.profile?.preferences?.notifications?.type).toBe('boolean');
      expect(tool?.parameters?.user?.settings?.type).toBe('array');
      expect(tool?.parameters?.metadata?.type).toBe('object');
    });

    it('should handle tools with array and union type parameters', () => {
      const request = {
        prompt: "Use tool with array and union types",
        tools: {
          array_union_tool: {
            description: "Tool with array and union type parameters",
            inputSchema: z.object({
              items: z.array(z.string()),
              count: z.union([z.literal('all'), z.number()]),
              options: z.array(z.union([
                z.literal('option1'),
                z.literal('option2'),
                z.literal('option3')
              ]))
            })
          }
        }
      };

      const response = {
        text: "Array and union types tool used"
      };

      const result = converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      // Should have available tools with array and union parameters
      expect(result.available_tools?.length).toBe(1);
      const tool = result.available_tools?.[0];
      expect(tool?.name).toBe('array_union_tool');
      expect(tool?.description).toBe('Tool with array and union type parameters');
      
      // Should have array and union parameters
      expect(tool?.parameters?.items?.type).toBe('array');
      expect(tool?.parameters?.items?.items?.type).toBe('string');
      
      expect(tool?.parameters?.count?.anyOf).toBeDefined();
      expect(tool?.parameters?.count?.anyOf?.length).toBe(2);
      expect(tool?.parameters?.count?.anyOf?.[0]?.const).toBe('all');
      expect(tool?.parameters?.count?.anyOf?.[1]?.type).toBe('number');
      
      expect(tool?.parameters?.options?.type).toBe('array');
      expect(tool?.parameters?.options?.items?.anyOf).toBeDefined();
      expect(tool?.parameters?.options?.items?.anyOf?.length).toBe(3);
    });
  });
});
