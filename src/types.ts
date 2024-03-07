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

export type Input = z.infer<typeof inputSchema>;

export const outputSchema = z.object({
  id: z.string(),
  created: z.number().optional(),
  model: z.string(),
  choices: z.array(choiceSchema),
  usage: usageSchema.optional(),
  system_fingerprint: z.string().optional(),
});

export type Output = z.infer<typeof outputSchema>;

export const evaluationSchema = z.object({
  async: z.boolean(),
  input: inputSchema,
  output: outputSchema,
});

const resultSchema = z.object({
  claim: z.string(),
  contradiction: z.boolean(),
  passed: z.boolean(),
  matchScore: z.number(),
  reason: z.string(),
  quote: z.string(),
  includedInContent: z.boolean(),
  monitorId: z.string(),
  createdAt: z.string(),
  organizationId: z.string(),
  callId: z.string(),
});

const evaluationResultSchema = z.object({
  type: z.string(),
  results: z.array(resultSchema),
});

const scoreBreakdownItemSchema = z.object({
  length: z.number(),
  scoreSum: z.number(),
});

const scoreBreakdownSchema = z.record(scoreBreakdownItemSchema);

export const evaluationResponseSchema = z.object({
  success: z.boolean(),
  evaluationResults: z.array(evaluationResultSchema),
  score: z.number(),
  status: z.string(),
  scoreBreakdown: scoreBreakdownSchema,
});

export type Evaluation = z.infer<typeof evaluationSchema>;
export type EvaluationResponse = z.infer<typeof evaluationResponseSchema>;
