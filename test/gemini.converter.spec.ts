import { GeminiAICanonicalEvaluationStrategy } from '../src/frameworks/gemini/gemini-converter';

describe('GeminiAICanonicalEvaluationStrategy', () => {
  let converter: GeminiAICanonicalEvaluationStrategy;

  beforeEach(() => {
    converter = new GeminiAICanonicalEvaluationStrategy();
  });

  describe('Gemini request handling', () => {
    it('should handle string request', async () => {
      const request = {
        contents: [
          {
            role: 'user',
            parts: [{ text: 'What is JavaScript?' }],
          },
        ],
        config: {
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'get_weather',
                  description: 'Get the current weather for a location',
                  parameters: {
                    properties: {
                      location: {
                        type: 'string',
                        description:
                          'The city and state, e.g. San Francisco, CA',
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
            },
          ],
        },
      };
      const response = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text: 'JavaScript is a programming language.' }],
            },
          },
        ],
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages?.length).toBe(2);

      expect(result.messages?.[0]?.role).toBe('user');
      expect(result.messages?.[0]?.content).toBe('What is JavaScript?');

      expect(result.messages?.[1]?.role).toBe('assistant');
      expect(result.messages?.[1]?.content).toBe(
        'JavaScript is a programming language.'
      );

      // Verify tools are properly included
      expect(result.available_tools).toBeDefined();
      expect(result.available_tools).toHaveLength(2);

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
    });

    it('should handle object request with message property', async () => {
      const request = {
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Explain async/await' }],
          },
        ],
      };

      const response = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                { text: 'Async/await is used for asynchronous programming.' },
              ],
            },
          },
        ],
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages?.length).toBe(2);

      expect(result.messages?.[0]?.role).toBe('user');
      expect(result.messages?.[0]?.content).toBe('Explain async/await');
    });

    it('should handle request without message property', async () => {
      const request = { model: 'gemini-pro' };
      const response = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text: 'Response text' }],
            },
          },
        ],
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages?.length).toBe(1); // Only assistant message
      const assistantMessage = result.messages?.find(
        m => m.role === 'assistant'
      );
      expect(assistantMessage?.content).toBe('Response text');
    });
  });

  describe('response structure handling', () => {
    it('should handle direct candidates response', async () => {
      const request = {
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Test question' }],
          },
        ],
      };
      const response = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text: 'First part' }, { text: 'Second part' }],
            },
          },
        ],
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages?.length).toBe(3); // user + 2 assistant parts
      const assistantMessages = result.messages?.filter(
        m => m.role === 'assistant'
      );
      expect(assistantMessages?.length).toBe(2);
      expect(assistantMessages?.[0].content).toBe('First part');
      expect(assistantMessages?.[1].content).toBe('Second part');
    });

    it('should handle multiple candidates', async () => {
      const request = {
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Test question' }],
          },
        ],
      };
      const response = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text: 'First candidate' }],
            },
          },
          {
            content: {
              role: 'model',
              parts: [{ text: 'Second candidate' }],
            },
          },
        ],
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages?.length).toBe(3); // user + 2 candidates
      const assistantMessages = result.messages?.filter(
        m => m.role === 'assistant'
      );
      expect(assistantMessages?.length).toBe(2);
      expect(assistantMessages?.[0].content).toBe('First candidate');
      expect(assistantMessages?.[1].content).toBe('Second candidate');
    });
  });

  describe('edge cases', () => {
    it('should handle empty candidates array', async () => {
      const request = {
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Test question' }],
          },
        ],
      };
      const response = { candidates: [] };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );
      expect(result.messages?.length).toBe(1); // Only user message
    });

    it('should handle missing candidates property', async () => {
      const request = {
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Test question' }],
          },
        ],
      };
      const response = { someOtherProperty: 'value' };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );
      expect(result.messages?.length).toBe(1); // Only user message
    });

    it('should handle empty parts array', async () => {
      const request = {
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Test question' }],
          },
        ],
      };
      const response = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [],
            },
          },
        ],
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );
      expect(result.messages?.length).toBe(1); // Only user message
    });
  });

  describe('streaming response', () => {
    it('should accumulate streaming chunks correctly', async () => {
      const request = {
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Schedule a meeting' }],
          },
        ],
      };

      // Mock streaming response chunks
      const response = [
        {
          candidates: [
            {
              content: {
                parts: [{ text: 'The meeting has been scheduled with' }],
                role: 'model',
              },
            },
          ],
          createTime: '2025-08-24T16:24:26.180768Z',
          modelVersion: 'gemini-2.5-flash',
          responseId: 'ujyraKCEC46cmecPqJHW6Qo',
          usageMetadata: { trafficType: 'ON_DEMAND' },
        },
        {
          candidates: [
            {
              content: {
                parts: [{ text: ' Bob and Alice for March 27, 2025, at 10:0' }],
                role: 'model',
              },
            },
          ],
          createTime: '2025-08-24T16:24:26.180768Z',
          modelVersion: 'gemini-2.5-flash',
          responseId: 'ujyraKCEC46cmecPqJHW6Qo',
          usageMetadata: { trafficType: 'ON_DEMAND' },
        },
        {
          candidates: [
            {
              content: {
                parts: [{ text: '0 AM to discuss Q3 planning.' }],
                role: 'model',
              },
              finishReason: 'STOP',
            },
          ],
          createTime: '2025-08-24T16:24:26.180768Z',
          modelVersion: 'gemini-2.5-flash',
          responseId: 'ujyraKCEC46cmecPqJHW6Qo',
          usageMetadata: {
            promptTokenCount: 322,
            candidatesTokenCount: 35,
            totalTokenCount: 357,
            trafficType: 'ON_DEMAND',
          },
        },
      ];

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages).toBeDefined();
      expect(result.messages?.length).toBe(2); // user and assistant

      // Should have user message
      const userMessage = result.messages?.find(m => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage?.content).toBe('Schedule a meeting');

      // Should have assistant message with accumulated content
      const assistantMessage = result.messages?.find(
        m => m.role === 'assistant'
      );
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toBe(
        'The meeting has been scheduled with Bob and Alice for March 27, 2025, at 10:00 AM to discuss Q3 planning.'
      );
    });

    it('should handle role changes in streaming chunks', async () => {
      const request = {
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Ask a question' }],
          },
        ],
      };

      // Mock streaming response with role change
      const response = [
        {
          candidates: [
            {
              content: {
                parts: [{ text: 'First response from model' }],
                role: 'model',
              },
            },
          ],
        },
        {
          candidates: [
            {
              content: {
                parts: [{ text: 'Second response from user' }],
                role: 'user',
              },
            },
          ],
        },
      ];

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages?.length).toBe(3); // user request + model response + user response

      const assistantMessage = result.messages?.find(
        m => m.role === 'assistant'
      );
      expect(assistantMessage?.content).toBe('First response from model');

      const userResponseMessage = result.messages?.find(
        m => m.role === 'user' && m.content === 'Second response from user'
      );
      expect(userResponseMessage).toBeDefined();
    });
  });
});
