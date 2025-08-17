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
  content: z.string().optional(),
  tool_calls: z.array(LLMToolCallSchema).optional(),
});


export type LLMMessage = z.infer<typeof LLMMessageSchema>;

const SyntaxCheckArgsSchema = z.object({
  args: z.string(),
});

export const EvaluationRequestModernSchema = z
  .object({
    framework: z.string(),
    request: z.any().optional(),
    response: z.any().optional(),
    dangerous_content_check: z.boolean().default(false).optional(),
    grounding_check: z.boolean().default(false).optional(),
    hallucinations_check: z.boolean().default(false).optional(),
    harassment_check: z.boolean().default(false).optional(),
    hate_speech_check: z.boolean().default(false).optional(),
    instructions_following_check: z.boolean().default(false).optional(),
    pii_check: z.boolean().default(false).optional(),
    prompt_injections: z.boolean().default(false).optional(),
    sexual_content_check: z.boolean().default(false).optional(),
    syntax_checks: z.record(z.string(), SyntaxCheckArgsSchema).optional(),
    tool_selection_quality_check: z.boolean().default(false).optional(),
  });

export const EvaluationRequestSchema = z
  .object({
    input: z.string().optional(),
    output: z.string().optional(),
    messages: z.array(LLMMessageSchema).optional(),
    available_tools: z.array(LLMToolDefinitionSchema).optional(),
    dangerous_content_check: z.boolean().default(false),
    grounding_check: z.boolean().default(false),
    hallucinations_check: z.boolean().default(false),
    harassment_check: z.boolean().default(false),
    hate_speech_check: z.boolean().default(false),
    instructions_following_check: z.boolean().default(false),
    pii_check: z.boolean().default(false),
    prompt_injections: z.boolean().default(false),
    sexual_content_check: z.boolean().default(false),
    syntax_checks: z.record(z.string(), SyntaxCheckArgsSchema).optional(),
    tool_selection_quality_check: z.boolean().default(false),
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

/**
 * Zod schema for validating OpenAI response creation parameters.
 * This schema is based on the comprehensive ResponseCreateParamsBase interface from OpenAI v5.x
 * and ensures that the request parameters match the expected OpenAI API format.
 */
export const OpenAIResponseRequestSchema = z.object({
  input: z.union([z.string(), z.any()]).optional(), // string | ResponseInput
});

/**
 * Zod schema for validating OpenAI response structure.
 * This schema is based on the comprehensive OpenAI Response interface and ensures
 * that the request object matches the expected OpenAI API response format with all
 * required fields and proper types. Used by the OpenAICanonicalEvaluationStrategy
 * to validate incoming requests before conversion to EvaluationRequest.
 */
export const OpenAIResponseSchema = z.object({
  // Required fields
  id: z.string(),
  created_at: z.number(),
  output_text: z.string(),
  model: z.string(),
  object: z.literal('response'),
  output: z.array(z.any()),
  parallel_tool_calls: z.boolean(),
  temperature: z.number().nullable(),
  tool_choice: z.any(),
  tools: z.array(z.any()),
  top_p: z.number().nullable(),

  // Optional fields
  background: z.boolean().nullable().optional(),
  max_output_tokens: z.number().nullable().optional(),
  previous_response_id: z.string().nullable().optional(),
  prompt: z.any().nullable().optional(),
  prompt_cache_key: z.string().optional(),
  reasoning: z.any().nullable().optional(),
  safety_identifier: z.string().optional(),
  service_tier: z
    .enum(['auto', 'default', 'flex', 'scale', 'priority'])
    .nullable()
    .optional(),
  status: z
    .enum([
      'completed',
      'failed',
      'in_progress',
      'cancelled',
      'queued',
      'incomplete',
    ])
    .optional(),
  text: z.any().optional(),
  truncation: z.enum(['auto', 'disabled']).nullable().optional(),
  usage: z.any().optional(),
  user: z.string().optional(),

  // Nullable fields
  error: z.any().nullable(),
  incomplete_details: z.any().nullable(),
  instructions: z.union([z.string(), z.array(z.any())]).nullable(),
  metadata: z.any().nullable(),

  // Custom fields for Qualifire integration
  input: z.string().optional(),
  messages: z.array(z.any()).optional(),
  available_tools: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        parameters: z.record(z.string(), z.any()),
      })
    )
    .optional(),
  dangerous_content_check: z.boolean().optional(),
  grounding_check: z.boolean().optional(),
  hallucinations_check: z.boolean().optional(),
  _request_id: z.string().nullable().optional(),

  // Legacy fields (kept for backward compatibility)
  store: z.boolean().optional(),
  top_logprobs: z.number().optional(),
  max_tool_calls: z.any().nullable().optional(),
});

export type OpenAIResponse = z.infer<typeof OpenAIResponseSchema>;
export type OpenAIResponseRequest = z.infer<typeof OpenAIResponseRequestSchema>;

export type EvaluationRequest = z.input<typeof EvaluationRequestSchema>;
export type EvaluationResponse = z.infer<typeof EvaluationResponseSchema>;

export type EvaluationModernRequest = z.infer<typeof EvaluationRequestModernSchema>;
