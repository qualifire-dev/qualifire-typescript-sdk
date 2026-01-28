import * as qualifire from '../src';

describe('index', () => {
  describe('myPackage', () => {
    it('should return a string containing the message', () => {
      console.log('later');
    });
  });

  describe('topic scoping fields', () => {
    it('should pass topic scoping fields in the API request (direct mode)', async () => {
      const capturedBodies: Record<string, unknown>[] = [];
      global.fetch = jest
        .fn()
        .mockImplementation((_url: string, options: { body: string }) => {
          capturedBodies.push(
            JSON.parse(options.body) as Record<string, unknown>
          );
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: 'passed',
                score: 100,
                evaluationResults: [],
              }),
          });
        }) as typeof fetch;

      const client = new qualifire.Qualifire({ apiKey: 'test-key' });
      await client.evaluate({
        input: 'What is AI?',
        output: 'Artificial Intelligence',
        groundingCheck: true,
        topicScopingMode: 'quality',
        topicScopingMultiTurnMode: true,
        topicScopingTarget: 'both',
      });

      expect(capturedBodies).toHaveLength(1);
      const body = capturedBodies[0];
      expect(body.topic_scoping_mode).toBe('quality');
      expect(body.topic_scoping_multi_turn_mode).toBe(true);
      expect(body.topic_scoping_target).toBe('both');
    });

    it('should pass topic scoping fields in the API request (framework mode)', async () => {
      const capturedBodies: Record<string, unknown>[] = [];
      global.fetch = jest
        .fn()
        .mockImplementation((_url: string, options: { body: string }) => {
          capturedBodies.push(
            JSON.parse(options.body) as Record<string, unknown>
          );
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: 'passed',
                score: 100,
                evaluationResults: [],
              }),
          });
        }) as typeof fetch;

      const client = new qualifire.Qualifire({ apiKey: 'test-key' });
      await client.evaluate({
        framework: 'openai',
        request: {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
        },
        response: {
          id: 'test',
          object: 'chat.completion',
          created: 123,
          model: 'gpt-4o',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Hi' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
        groundingCheck: true,
        topicScopingMode: 'speed',
        topicScopingMultiTurnMode: false,
        topicScopingTarget: 'input',
      });

      expect(capturedBodies).toHaveLength(1);
      const body = capturedBodies[0];
      expect(body.topic_scoping_mode).toBe('speed');
      expect(body.topic_scoping_multi_turn_mode).toBe(false);
      expect(body.topic_scoping_target).toBe('input');
    });
  });
});
