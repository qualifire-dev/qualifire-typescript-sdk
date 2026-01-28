import { z } from 'zod';

// Framework type based on supported frameworks
const FrameworkEnum = ['openai', 'vercelai', 'gemini', 'claude'] as const;
export type Framework = (typeof FrameworkEnum)[number];

// Model mode enum
const ModelModeEnum = ['speed', 'balanced', 'quality'] as const;
export type ModelMode = (typeof ModelModeEnum)[number];

// Policy target enum
const PolicyTargetEnum = ['input', 'output', 'both'] as const;
export type PolicyTarget = (typeof PolicyTargetEnum)[number];

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

export const LLMToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.string(), z.any()),
});
export const LLMToolCallSchema = z.object({
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

export const EvaluationRequestV2Schema = z.object({
  framework: z.enum(FrameworkEnum),
  request: z.any().optional(),
  response: z.any().optional(),
  /** @deprecated Use request/response instead */
  input: z.string().optional(),
  /** @deprecated Use request/response instead */
  output: z.string().optional(),
  /** @deprecated Use request/response instead */
  messages: z.array(LLMMessageSchema).optional(),
  /** @deprecated Use contentModerationCheck instead */
  dangerousContentCheck: z.boolean().default(false).optional(),
  groundingCheck: z.boolean().default(false).optional(),
  hallucinationsCheck: z.boolean().default(false).optional(),
  /** @deprecated Use contentModerationCheck instead */
  harassmentCheck: z.boolean().default(false).optional(),
  /** @deprecated Use contentModerationCheck instead */
  hateSpeechCheck: z.boolean().default(false).optional(),
  instructionsFollowingCheck: z.boolean().default(false).optional(),
  piiCheck: z.boolean().default(false).optional(),
  promptInjections: z.boolean().default(false).optional(),
  /** @deprecated Use contentModerationCheck instead */
  sexualContentCheck: z.boolean().default(false).optional(),
  contentModerationCheck: z.boolean().default(false).optional(),
  syntaxChecks: z.record(z.string(), SyntaxCheckArgsSchema).optional(),
  toolSelectionQualityCheck: z.boolean().default(false).optional(),
  assertions: z.array(z.string()).optional(),
  /** @deprecated Automatically added from the request*/
  available_tools: z.array(LLMToolDefinitionSchema).optional(),
  /** @deprecated Use dangerousContentCheck instead */
  dangerous_content_check: z.boolean().default(false).optional(),
  /** @deprecated Use groundingCheck instead */
  grounding_check: z.boolean().default(false).optional(),
  /** @deprecated Use hallucinationsCheck instead */
  hallucinations_check: z.boolean().default(false).optional(),
  /** @deprecated Use harassmentCheck instead */
  harassment_check: z.boolean().default(false).optional(),
  /** @deprecated Use hateSpeechCheck instead */
  hate_speech_check: z.boolean().default(false).optional(),
  /** @deprecated Use instructionsFollowingCheck instead */
  instructions_following_check: z.boolean().default(false).optional(),
  /** @deprecated Use piiCheck instead */
  pii_check: z.boolean().default(false).optional(),
  /** @deprecated Use promptInjections instead */
  prompt_injections: z.boolean().default(false).optional(),
  /** @deprecated Use sexualContentCheck instead */
  sexual_content_check: z.boolean().default(false).optional(),
  /** @deprecated Use syntaxChecks instead */
  syntax_checks: z.record(z.string(), SyntaxCheckArgsSchema).optional(),
  /** @deprecated Use toolSelectionQualityCheck instead */
  tool_selection_quality_check: z.boolean().default(false).optional(),
  tsqMode: z.enum(ModelModeEnum).default('balanced').optional(),
  consistencyMode: z.enum(ModelModeEnum).default('balanced').optional(),
  assertionsMode: z.enum(ModelModeEnum).default('balanced').optional(),
  groundingMode: z.enum(ModelModeEnum).default('balanced').optional(),
  hallucinationsMode: z.enum(ModelModeEnum).default('balanced').optional(),
  groundingMultiTurnMode: z.boolean().default(false).optional(),
  policyMultiTurnMode: z.boolean().default(false).optional(),
  policyTarget: z.enum(PolicyTargetEnum).optional(),
  topicScopingMode: z.enum(ModelModeEnum).default('balanced').optional(),
  topicScopingMultiTurnMode: z.boolean().default(false).optional(),
  topicScopingTarget: z.enum(PolicyTargetEnum).optional(),
});

export const EvaluationProxyAPIRequestSchema = z
  .object({
    /** @deprecated Use request/response instead */
    input: z.string().optional(),
    /** @deprecated Use request/response instead */
    output: z.string().optional(),
    /** @deprecated Use request/response instead */
    messages: z.array(LLMMessageSchema).optional(),
    /** @deprecated Use request/response instead */
    available_tools: z.array(LLMToolDefinitionSchema).optional(),
    /** @deprecated Use contentModerationCheck instead */
    dangerous_content_check: z.boolean().default(false),
    /** @deprecated Use groundingCheck instead */
    grounding_check: z.boolean().default(false),
    /** @deprecated Use hallucinationsCheck instead */
    hallucinations_check: z.boolean().default(false),
    /** @deprecated Use contentModerationCheck instead */
    harassment_check: z.boolean().default(false),
    /** @deprecated Use contentModerationCheck instead */
    hate_speech_check: z.boolean().default(false),
    /** @deprecated Use instructionsFollowingCheck instead */
    instructions_following_check: z.boolean().default(false),
    /** @deprecated Use piiCheck instead */
    pii_check: z.boolean().default(false),
    /** @deprecated Use promptInjections instead */
    prompt_injections: z.boolean().default(false),
    /** @deprecated Use contentModerationCheck instead */
    sexual_content_check: z.boolean().default(false),
    /** @deprecated Use syntaxChecks instead */
    syntax_checks: z.record(z.string(), SyntaxCheckArgsSchema).optional(),
    /** @deprecated Use toolSelectionQualityCheck instead */
    tool_selection_quality_check: z.boolean().default(false),
    assertions: z.array(z.string()).optional(),
    /** @deprecated Use contentModerationCheck instead */
    dangerousContentCheck: z.boolean().default(false).optional(),
    groundingCheck: z.boolean().default(false).optional(),
    hallucinationsCheck: z.boolean().default(false).optional(),
    /** @deprecated Use contentModerationCheck instead */
    harassmentCheck: z.boolean().default(false).optional(),
    /** @deprecated Use contentModerationCheck instead */
    hateSpeechCheck: z.boolean().default(false).optional(),
    instructionsFollowingCheck: z.boolean().default(false).optional(),
    piiCheck: z.boolean().default(false).optional(),
    promptInjections: z.boolean().default(false).optional(),
    /** @deprecated Use contentModerationCheck instead */
    sexualContentCheck: z.boolean().default(false).optional(),
    contentModerationCheck: z.boolean().default(false).optional(),
    syntaxChecks: z.record(z.string(), SyntaxCheckArgsSchema).optional(),
    toolSelectionQualityCheck: z.boolean().default(false).optional(),
    tsqMode: z.enum(ModelModeEnum).default('balanced').optional(),
    consistencyMode: z.enum(ModelModeEnum).default('balanced').optional(),
    assertionsMode: z.enum(ModelModeEnum).default('balanced').optional(),
    groundingMode: z.enum(ModelModeEnum).default('balanced').optional(),
    hallucinationsMode: z.enum(ModelModeEnum).default('balanced').optional(),
    groundingMultiTurnMode: z.boolean().default(false).optional(),
    policyMultiTurnMode: z.boolean().default(false).optional(),
    policyTarget: z.enum(PolicyTargetEnum).optional(),
    topic_scoping_mode: z.enum(ModelModeEnum).default('balanced').optional(),
    topic_scoping_multi_turn_mode: z.boolean().default(false).optional(),
    topic_scoping_target: z.enum(PolicyTargetEnum).optional(),
    topicScopingMode: z.enum(ModelModeEnum).default('balanced').optional(),
    topicScopingMultiTurnMode: z.boolean().default(false).optional(),
    topicScopingTarget: z.enum(PolicyTargetEnum).optional(),
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

export type EvaluationProxyAPIRequest = z.input<
  typeof EvaluationProxyAPIRequestSchema
>;
export type EvaluationResponse = z.infer<typeof EvaluationResponseSchema>;
export type LLMToolDefinition = z.infer<typeof LLMToolDefinitionSchema>;
export type LLMToolCall = z.infer<typeof LLMToolCallSchema>;
export type EvaluationRequestV2 = z.infer<typeof EvaluationRequestV2Schema>;
