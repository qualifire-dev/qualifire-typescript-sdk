import { z } from 'zod';

export const messageSchema = z.object({
  role: z.string(),
  content: z.string().nullable(),
});

export const choiceSchema = z.object({
  index: z.number(),
  message: messageSchema,
  finish_reason: z.string().optional(),
});

export const usageSchema = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
});

export const inputSchema = z.object({
  model: z.string(),
  messages: z.array(messageSchema),
  caller: z.string().optional(),
});

export type Input = z.infer<typeof inputSchema> | string;

export const outputSchema = z.object({
  id: z.string(),
  created: z.number().optional(),
  model: z.string(),
  choices: z.array(choiceSchema),
  usage: usageSchema.optional(),
  system_fingerprint: z.string().optional(),
});

export type Output = z.infer<typeof outputSchema> | string;

const LLMToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.string(), z.any()),
});

const LLMToolCallSchema = z.object({
  name: z.string(),
  arguments: z.record(z.string(), z.any()),
  id: z.string().optional(),
});

const LLMMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
  tool_calls: z.array(LLMToolCallSchema).optional(),
});

const SyntaxCheckArgsSchema = z.object({
  args: z.string(),
});

export const EvaluationRequestSchema = z
  .object({
    input: z.string().optional(),
    output: z.string().optional(),
    messages: z.array(LLMMessageSchema).optional(),
    available_tools: z.array(LLMToolDefinitionSchema).optional(),
    dangerous_content_check: z.boolean(),
    grounding_check: z.boolean(),
    hallucinations_check: z.boolean(),
    harassment_check: z.boolean(),
    hate_speech_check: z.boolean(),
    instructions_following_check: z.boolean(),
    pii_check: z.boolean(),
    prompt_injections: z.boolean(),
    sexual_content_check: z.boolean(),
    syntax_checks: z.record(z.string(), SyntaxCheckArgsSchema).optional(),
    tool_selection_quality_check: z.boolean(),
    assertions: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    const hasMessages =
      Array.isArray(data.messages) && data.messages.length > 0;
    const hasInput = typeof data.input === 'string' && data.input.trim() !== '';
    const hasOutput =
      typeof data.output === 'string' && data.output.trim() !== '';

    // Validation: At least one of messages, input, or output
    if (!hasMessages && !hasInput && !hasOutput) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one of messages, input, or output must be set',
        path: [], // Top level
      });
    }

    // Validation: tool_selection_quality_check requires messages and available_tools
    if (data.tool_selection_quality_check) {
      const hasAvailableTools =
        Array.isArray(data.available_tools) && data.available_tools.length > 0;

      if (!hasMessages) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'messages must be provided when tool_selection_quality_check is true',
          path: ['messages'],
        });
      }
      if (!hasAvailableTools) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'available_tools must be provided when tool_selection_quality_check is true',
          path: ['available_tools'],
        });
      }
    }
  });

const EvaluationResultSchema = z.object({
  claim: z.string(),
  confidence_score: z.number(),
  label: z.string(),
  name: z.string(),
  quote: z.string(),
  reason: z.string(),
  score: z.number(),
});

const EvaluationResultItemSchema = z.object({
  results: z.array(EvaluationResultSchema),
  type: z.string(),
});

const EvaluationResponseSchema = z.object({
  evaluationResults: z.array(EvaluationResultItemSchema),
  score: z.number(),
  status: z.string(),
});

export type EvaluationResponse = z.infer<typeof EvaluationResponseSchema>;
export type EvaluationRequest = z.infer<typeof EvaluationRequestSchema>;
