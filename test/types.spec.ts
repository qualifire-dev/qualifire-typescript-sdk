import { EvaluationRequestSchema } from '../src/types';

const _test_llm_messages = [
  {
    role: 'user',
    content: 'test',
  },
];

const _test_available_tools = [
  {
    name: 'foo',
    description: 'foo tool function definition',
    parameters: {
      type: 'object',
      properties: {
        bar: { type: 'string' },
        baz: { type: 'integer' },
      },
      required: ['bar', 'baz'],
    },
  },
];

describe('EvaluationRequestSchema', () => {
  describe('validate messages/input/output requirements', () => {
    const testCases = [
      [null, null, null, true],
      [[], null, null, true],
      [null, '', null, true],
      [null, null, '', true],
      [_test_llm_messages, null, null, false],
      [_test_llm_messages, '', null, false],
      [_test_llm_messages, null, '', false],
      [_test_llm_messages, '', '', false],
      [null, 'input', null, false],
      [null, 'input', '', false],
      [[], 'input', null, false],
      [[], 'input', '', false],
      [null, null, 'output', false],
      [null, '', 'output', false],
      [[], null, 'output', false],
      [[], '', 'output', false],
      [_test_llm_messages, 'input', null, false],
      [_test_llm_messages, 'input', '', false],
      [_test_llm_messages, null, 'output', false],
      [_test_llm_messages, '', 'output', false],
      [null, 'input', 'output', false],
      [[], 'input', 'output', false],
      [_test_llm_messages, 'input', 'output', false],
    ] as const;

    test.each(testCases)(
      'messages: %p, input: %p, output: %p -> should fail: %p',
      (messages, input, output, shouldError) => {
        const payload = {
          input: input ?? undefined,
          output: output ?? undefined,
          messages: messages ?? undefined,
          available_tools: [],
          dangerous_content_check: false,
          grounding_check: false,
          hallucinations_check: false,
          harassment_check: false,
          hate_speech_check: false,
          instructions_following_check: false,
          pii_check: false,
          prompt_injections: false,
          sexual_content_check: false,
          syntax_checks: undefined,
          tool_selection_quality_check: false,
          assertions: undefined,
        };

        if (shouldError) {
          expect(() => EvaluationRequestSchema.parse(payload)).toThrow();
        } else {
          expect(() => EvaluationRequestSchema.parse(payload)).not.toThrow();
        }
      }
    );
  });

  describe('validate tool_selection_quality_check requirements', () => {
    const testCases = [
      [true, null, null, true],
      [true, [], null, true],
      [true, null, [], true],
      [true, [], [], true],
      [true, _test_llm_messages, null, true],
      [true, _test_llm_messages, [], true],
      [true, null, _test_available_tools, true],
      [true, [], _test_available_tools, true],
      [true, _test_llm_messages, _test_available_tools, false],
      [false, null, null, false],
      [false, [], null, false],
      [false, null, [], false],
      [false, [], [], false],
      [false, _test_llm_messages, null, false],
      [false, _test_llm_messages, [], false],
      [false, null, _test_available_tools, false],
      [false, [], _test_available_tools, false],
      [false, _test_llm_messages, _test_available_tools, false],
    ] as const;

    test.each(testCases)(
      'tool_selection_quality_check: %p, messages: %p, available_tools: %p -> should fail: %p',
      (tsq_check, messages, tools, shouldError) => {
        const payload = {
          input: 'input', // included to bypass the input/output/messages check
          messages: messages ?? undefined,
          available_tools: tools ?? undefined,
          dangerous_content_check: false,
          grounding_check: false,
          hallucinations_check: false,
          harassment_check: false,
          hate_speech_check: false,
          pii_check: false,
          prompt_injections: false,
          sexual_content_check: false,
          instructions_following_check: false,
          tool_selection_quality_check: tsq_check,
        };

        if (shouldError) {
          expect(() => EvaluationRequestSchema.parse(payload)).toThrow();
        } else {
          expect(() => EvaluationRequestSchema.parse(payload)).not.toThrow();
        }
      }
    );
  });
});
