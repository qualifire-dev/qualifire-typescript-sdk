import { GeminiAICanonicalEvaluationStrategy } from '../src/frameworks/gemini/gemini-converter';

describe('GeminiAICanonicalEvaluationStrategy', () => {
  let converter: GeminiAICanonicalEvaluationStrategy;

  beforeEach(() => {
    converter = new GeminiAICanonicalEvaluationStrategy();
  });

  describe('VertexAI response', () => {
    it('should convert VertexAI Gemini response', async () => {
      const request = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'How can I learn more about Node.js?' }
            ]
          }
        ]
      };

      // Mock VertexAI response
      const response = {
        response: {
          candidates: [
            {
              content: {
                role: 'model',
                parts: [
                  { 
                    text: 'Node.js is a JavaScript runtime built on Chrome\'s V8 JavaScript engine. It allows you to run JavaScript on the server side. To learn more about Node.js, you can start with the official documentation, take online courses, or practice building simple applications. Node.js is great for building web servers, APIs, and real-time applications.' 
                  }
                ],
              },
            },
          ],
        },
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages).toBeDefined();
      expect(result.messages?.length).toBe(2); // user and assistant

      // Should have user message
      const userMessage = result.messages?.find(m => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage?.content).toBe('How can I learn more about Node.js?');

      // Should have assistant message from model
      const assistantMessage = result.messages?.find(m => m.role === 'assistant');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toBeTruthy();
      expect(assistantMessage?.content).toContain('Node.js'); // Response should mention Node.js
      expect(assistantMessage?.content).toContain('JavaScript'); // Response content
      expect(assistantMessage?.content?.length).toBeGreaterThan(100); // Should be a substantial response
    });
  });

  describe('Gemini request handling', () => {
    it('should handle string request', async () => {
      const request = {
        contents: [
          {
            role: 'user',
            parts: [{ text: 'What is JavaScript?' }]
          }
        ]
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

      const userMessage = result.messages?.find(m => m.role === 'user');
      expect(userMessage?.content).toBe('What is JavaScript?');

      const assistantMessage = result.messages?.find(m => m.role === 'assistant');
      expect(assistantMessage?.content).toBe(
        'JavaScript is a programming language.'
      );
    });

    it('should handle object request with message property', async () => {
      const request = {
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Explain async/await' }]
          }
        ]
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

      const userMessage = result.messages?.find(m => m.role === 'user');
      expect(userMessage?.content).toBe('Explain async/await');
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
      const assistantMessage = result.messages?.find(m => m.role === 'assistant');
      expect(assistantMessage?.content).toBe('Response text');
    });
  });

  describe('response structure handling', () => {
    it('should handle direct candidates response', async () => {
      const request = {
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Test question' }]
          }
        ]
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

    it('should handle nested response.response structure', async () => {
      const request = {
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Test question' }]
          }
        ]
      };
      const response = {
        response: {
          candidates: [
            {
              content: {
                role: 'model',
                parts: [{ text: 'Nested response' }],
              },
            },
          ],
        },
      };

      const result = await converter.convertToQualifireEvaluationRequest(
        request,
        response
      );

      expect(result.messages?.length).toBe(2);
      const assistantMessage = result.messages?.find(m => m.role === 'assistant');
      expect(assistantMessage?.content).toBe('Nested response');
    });

    it('should handle multiple candidates', async () => {
      const request = {
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Test question' }]
          }
        ]
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

      const result = await  converter.convertToQualifireEvaluationRequest(
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
            parts: [{ text: 'Test question' }]
          }
        ]
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
            parts: [{ text: 'Test question' }]
          }
        ]
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
            parts: [{ text: 'Test question' }]
          }
        ]
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
});
