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

const LLMMessageSchema = z.object({
  content: z.string(),
  role: z.string(),
});

const EvaluationRequestSchema = z.object({
  input: z.string(),
  output: z.string(),
  consistency_check: z.boolean(),
  dangerous_content_check: z.boolean(),
  hallucinations_check: z.boolean(),
  harassment_check: z.boolean(),
  hate_speech_check: z.boolean(),
  pii_check: z.boolean(),
  prompt_injections: z.boolean(),
  sexual_content_check: z.boolean(),
  messages: z.array(LLMMessageSchema).optional(),
  assertions: z.array(z.string()).optional(),
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
export type EvaluationRequestSchema = z.infer<typeof EvaluationRequestSchema>;
