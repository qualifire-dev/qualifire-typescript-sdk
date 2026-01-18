import * as traceloop from '@traceloop/node-server-sdk';
import { CanonicalEvaluationStrategy } from './frameworks/canonical';
import { ClaudeCanonicalEvaluationStrategy } from './frameworks/claude/claude-converter';
import { GeminiAICanonicalEvaluationStrategy } from './frameworks/gemini/gemini-converter';
import { OpenAICanonicalEvaluationStrategy } from './frameworks/openai/openai-converter';
import { VercelAICanonicalEvaluationStrategy } from './frameworks/vercelai/vercelai-converter';
import {
  type CompilePromptResponse,
  EvaluationProxyAPIRequest,
  EvaluationProxyAPIRequestSchema,
  type EvaluationRequestV2,
  EvaluationRequestV2Schema,
  type EvaluationResponse,
  type Framework,
} from './types';

export type {
  CompilePromptResponse,
  EvaluationProxyAPIRequest,
  EvaluationRequestV2,
  EvaluationResponse,
  Framework,
  LLMMessage,
  ModelMode,
  PolicyTarget,
  ToolResponse,
} from './types';

/**
 * Represents the Qualifire SDK.
 */
/**
 * The Qualifire class represents the Qualifire SDK.
 */
export class Qualifire {
  sdkKey: string;
  baseUrl: string;

  /**
   * Creates an instance of the Qualifire class.
   * @param apiKey - The API key for the Qualifire SDK.
   * @param baseUrl - The base URL for the Qualifire API.
   */
  constructor({ apiKey, baseUrl }: { apiKey?: string; baseUrl?: string }) {
    const key = apiKey || process.env.QUALIFIRE_API_KEY;
    const qualifireBaseUrl =
      baseUrl || process.env.QUALIFIRE_BASE_URL || 'https://proxy.qualifire.ai';

    if (!key) {
      throw new Error(
        'Missing SDK key, please provide an arg or add the QUALIFIRE_API_KEY environment variable.'
      );
    }

    this.sdkKey = key;
    this.baseUrl = qualifireBaseUrl;
  }

  init(): void {
    process.env.TRACELOOP_TELEMETRY = 'false';

    traceloop.initialize({
      baseUrl: `${this.baseUrl}/api/telemetry`,
      headers: {
        'X-Qualifire-API-Key': this.sdkKey,
      },
      traceloopSyncEnabled: false,
      silenceInitializationMessage: true,
      disableBatch: true,
    });
  }

  /**
   * Evaluates the output of a model against a set of criteria.
   *
   * This function supports two modes:
   * 1. Request-Response mode: If `request`, `response` and `framework` are provided, they fully analyzed by the Qualifire API
   * 2. Fine-grained messages mode: If `messages`, `input` or `output` are provided, they are sent specifically to the Qualifire API
   *
   * Supported frameworks are: openai, vercelai, gemini, claude
   * Note: Direct messages are deprecated, but still supported for backward compatibility.
   *
   * @param EvaluationRequestV2 - The evaluation request with either direct messages or framework-specific request/response
   * @returns An object containing the evaluation results.
   *
   * @example
   * ```ts
   * const qualifire = new Qualifire();
   *
   * // Request-Response mode
   * const openAiRequest = {
   * model: 'gpt-4o',
   *  messages: [
   *    {
   *      role: 'system',
   *      content: 'You are a helpful assistant that can answer questions.',
   *    },
   *    {
   *      role: 'user',
   *      content: [
   *        {
   *          type: 'text',
   *          text: 'Are the sky blue?',
   *        },
   *      ],
   *    },
   *  ],
   * };
   *
   * const openAiResponse = await openaiClient.chat.completions.create(
   *   openAiRequest
   * );
   *
   * const qualifireResponse = await qualifireClient.evaluate({
   *  framework: 'openai',
   *  request: openaiRequest, // As given to openaiClient.chat.completions.create(), openaiClient.responses.create()
   *  response: openaiResponse, // Response as returned by openaiClient.chat.completions.create() or openaiClient.responses.create()
   *  contentModerationCheck: true,
   *  groundingCheck: true,
   *  hallucinationsCheck: true,
   *  instructionsFollowingCheck: true,
   *  piiCheck: true,
   *  promptInjections: true,
   *  toolUseQualityCheck: false, // Use this instead of deprecated toolSelectionQualityCheck
   * });
   *
   * // If you are using streaming mode.
   * const openAiRequestStream = {
   *  stream: true,
   *  model: 'gpt-4o',
   *  messages: [
   *    {
   *      role: 'system',
   *      content: 'You are a helpful assistant that can answer questions.',
   *    },
   *    {
   *      role: 'user',
   *      content: [
   *        {
   *          type: 'text',
   *          text: 'Are the sky blue?',
   *        },
   *      ],
   *    },
   *  ],
   * };
   *
   * const openAiResponseStream = await openaiClient.chat.completions.create(
   *   openAiRequestStream
   * );
   *
   * let ResponseChunks: any[] = [];
   * for await (const chunk of openAiResponseStream) {
   *   ResponseChunks.push(chunk);
   * }
   *
   * const qualifireResponse = await qualifireClient.evaluate({
   *   framework: 'openai',
   *   request: openAiRequestStream,
   *   response: ResponseChunks,
   *   groundingCheck: true,
   *   promptInjections: true,
   * });
   *
   * // Fine-grained messages mode
   * const response2 = await qualifire.evaluate({
   *   messages: [
   *     { role: 'user', content: 'What is the capital of France?' },
   *     { role: 'assistant', content: 'Paris' }
   *   ],
   *   contentModerationCheck: true,
   *   hallucinationsCheck: true,
   * });
   * ```
   *
   * // A typical output for qualifire response would be:
   * Qualifire response: {
   *  "status": "failed",
   *  "score": 75,
   *  "evaluationResults": [
   *    {
   *      "type": "grounding",
   *      "results": [
   *        {
   *          "name": "grounding",
   *          "score": 75,
   *          "label": "INFERABLE",
   *          "confidence_score": 100,
   *          "reason": "The AI's output provides a detailed scientific explanation for why the sky is blue."
   *        }
   *      ]
   *    }
   *  ]
   * }
   */
  evaluate = async (
    evaluationRequest: EvaluationProxyAPIRequest | EvaluationRequestV2
  ): Promise<EvaluationResponse | undefined> => {
    // If messages are provided directly, use them as-is without conversion
    const parseEvaluationProxyAPIRequest =
      EvaluationProxyAPIRequestSchema.safeParse(evaluationRequest);
    if (parseEvaluationProxyAPIRequest.success) {
      return this.evaluateWithBackwardCompatibility(
        parseEvaluationProxyAPIRequest.data as EvaluationProxyAPIRequest
      );
    }

    const parseEvaluationRequestResultV2 =
      EvaluationRequestV2Schema.safeParse(evaluationRequest);
    if (parseEvaluationRequestResultV2.success) {
      return this.evaluateWithConverters(parseEvaluationRequestResultV2.data);
    }

    throw new Error(
      `Invalid evaluation request format: ${JSON.stringify(evaluationRequest)}`
    );
  };

  /**
   * Evaluates using direct messages without conversion (overrides request/response if both are provided)
   */
  private evaluateWithBackwardCompatibility = async (
    evaluationProxyAPIRequest: EvaluationProxyAPIRequest
  ): Promise<EvaluationResponse | undefined> => {
    // Compute contentModerationCheck from deprecated fields or use the new field
    const contentModerationCheck =
      evaluationProxyAPIRequest.contentModerationCheck ||
      evaluationProxyAPIRequest.dangerous_content_check ||
      evaluationProxyAPIRequest.dangerousContentCheck ||
      evaluationProxyAPIRequest.harassment_check ||
      evaluationProxyAPIRequest.harassmentCheck ||
      evaluationProxyAPIRequest.hate_speech_check ||
      evaluationProxyAPIRequest.hateSpeechCheck ||
      evaluationProxyAPIRequest.sexual_content_check ||
      evaluationProxyAPIRequest.sexualContentCheck;

    const url = `${this.baseUrl}/api/evaluation/evaluate`;
    const body = {
      input: evaluationProxyAPIRequest.input,
      output: evaluationProxyAPIRequest.output,
      messages: evaluationProxyAPIRequest.messages,
      available_tools: evaluationProxyAPIRequest.available_tools,
      content_moderation_check: contentModerationCheck,
      grounding_check:
        evaluationProxyAPIRequest.grounding_check ||
        evaluationProxyAPIRequest.groundingCheck,
      hallucinations_check:
        evaluationProxyAPIRequest.hallucinations_check ||
        evaluationProxyAPIRequest.hallucinationsCheck,
      instructions_following_check:
        evaluationProxyAPIRequest.instructions_following_check ||
        evaluationProxyAPIRequest.instructionsFollowingCheck,
      pii_check:
        evaluationProxyAPIRequest.pii_check ||
        evaluationProxyAPIRequest.piiCheck,
      prompt_injections:
        evaluationProxyAPIRequest.prompt_injections ||
        evaluationProxyAPIRequest.promptInjections,
      syntax_checks:
        evaluationProxyAPIRequest.syntax_checks ||
        evaluationProxyAPIRequest.syntaxChecks,
      tool_use_quality_check:
        evaluationProxyAPIRequest.toolUseQualityCheck ||
        evaluationProxyAPIRequest.toolSelectionQualityCheck ||
        evaluationProxyAPIRequest.tool_selection_quality_check,
      tuq_mode:
        evaluationProxyAPIRequest.tuqMode ?? evaluationProxyAPIRequest.tsqMode,
      assertions: evaluationProxyAPIRequest.assertions,
    };

    const headers = {
      'Content-Type': 'application/json',
      'X-Qualifire-API-Key': this.sdkKey,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Qualifire API error: ${response.statusText}`);
    }

    const jsonResponse = await response.json();
    return jsonResponse as EvaluationResponse;
  };

  /**
   * Evaluates using framework converters for request/response
   */
  private evaluateWithConverters = async (
    EvaluationRequestV2: EvaluationRequestV2
  ): Promise<EvaluationResponse | undefined> => {
    // Compute contentModerationCheck from deprecated fields or use the new field
    const contentModerationCheck =
      EvaluationRequestV2.contentModerationCheck ||
      EvaluationRequestV2.dangerousContentCheck ||
      EvaluationRequestV2.harassmentCheck ||
      EvaluationRequestV2.hateSpeechCheck ||
      EvaluationRequestV2.sexualContentCheck;

    const frameworkConverters: Record<
      Framework,
      () => CanonicalEvaluationStrategy<any, any>
    > = {
      openai: () => new OpenAICanonicalEvaluationStrategy(),
      vercelai: () => new VercelAICanonicalEvaluationStrategy(),
      gemini: () => new GeminiAICanonicalEvaluationStrategy(),
      claude: () => new ClaudeCanonicalEvaluationStrategy(),
    };

    const supportedFrameworks = Object.keys(frameworkConverters);
    const converterFactory = frameworkConverters[EvaluationRequestV2.framework];

    if (!converterFactory) {
      throw new Error(
        `Unsupported framework: ${
          EvaluationRequestV2.framework
        }. Supported frameworks: ${supportedFrameworks.join(', ')}`
      );
    }

    const requestConverter = converterFactory();

    const evaluationRequest =
      await requestConverter.convertToQualifireEvaluationRequest(
        EvaluationRequestV2.request,
        EvaluationRequestV2.response
      );

    const url = `${this.baseUrl}/api/evaluation/evaluate`;
    const body = {
      messages: evaluationRequest.messages,
      available_tools: evaluationRequest.available_tools,
      content_moderation_check: contentModerationCheck,
      grounding_check: EvaluationRequestV2.groundingCheck,
      hallucinations_check: EvaluationRequestV2.hallucinationsCheck,
      instructions_following_check:
        EvaluationRequestV2.instructionsFollowingCheck,
      pii_check: EvaluationRequestV2.piiCheck,
      prompt_injections: EvaluationRequestV2.promptInjections,
      syntax_checks: EvaluationRequestV2.syntaxChecks,
      tool_use_quality_check:
        EvaluationRequestV2.toolUseQualityCheck ||
        EvaluationRequestV2.toolSelectionQualityCheck ||
        EvaluationRequestV2.tool_selection_quality_check,
      tuq_mode: EvaluationRequestV2.tuqMode ?? EvaluationRequestV2.tsqMode,
      assertions: EvaluationRequestV2.assertions,
    };

    const headers = {
      'Content-Type': 'application/json',
      'X-Qualifire-API-Key': this.sdkKey,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Qualifire API error: ${response.statusText}`);
    }

    const jsonResponse = await response.json();
    return jsonResponse as EvaluationResponse;
  };

  /**
   * Invokes an evaluation for a given evaluation ID.
   *
   * @param input - The input to the model.
   * @param output - The output of the model.
   * @param evaluationId - The ID of the evaluation to invoke.
   * @returns An object containing the evaluation results.
   *
   * @example
   * ```ts
   * const qualifire = new Qualifire();
   * const response = await qualifire.invokeEvaluation({
   *   input: 'What is the capital of France?',
   *   output: 'Paris',
   *   evaluationId: '1234567890',
   * });
   * ```
   **/
  invokeEvaluation = async ({
    input,
    output,
    evaluationId,
  }: {
    input: string;
    output: string;
    evaluationId: string;
  }): Promise<EvaluationResponse | undefined> => {
    const url = `${this.baseUrl}/api/evaluation/invoke`;
    const body = JSON.stringify({
      input,
      output,
      evaluation_id: evaluationId,
    });

    const headers = {
      'Content-Type': 'application/json',
      'X-Qualifire-API-Key': this.sdkKey,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`Qualifire API error: ${response.statusText}`);
    }

    const jsonResponse = await response.json();
    return jsonResponse as EvaluationResponse;
  };

  /**
   * Compiles a prompt from Qualifire Studio with the specified parameters.
   *
   * @param promptId - The ID of the prompt to compile.
   * @param revisionId - Optional revision ID to use. If not provided, uses the latest revision.
   * @param params - Optional dictionary of parameters to substitute in the prompt template.
   * @returns A CompilePromptResponse containing the compiled prompt details.
   *
   * @example
   * ```ts
   * const qualifire = new Qualifire({ apiKey: 'your_api_key' });
   *
   * const response = await qualifire.compilePrompt({
   *   promptId: 'prompt-123',
   *   revisionId: 'rev-456',
   *   params: {
   *     user_name: 'John',
   *     language: 'French'
   *   }
   * });
   *
   * console.log(response.messages);
   * console.log(response.tools);
   * ```
   */
  compilePrompt = async ({
    promptId,
    revisionId,
    params,
  }: {
    promptId: string;
    revisionId?: string;
    params?: Record<string, string>;
  }): Promise<CompilePromptResponse> => {
    let url = `${this.baseUrl}/api/v1/studio/prompts/${promptId}/compile`;
    if (revisionId) {
      url = `${url}?revision=${revisionId}`;
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-Qualifire-API-Key': this.sdkKey,
    };

    const body = JSON.stringify({
      variables: params || {},
    });

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`Qualifire API error: ${response.statusText}`);
    }

    const jsonResponse = await response.json();
    return jsonResponse as CompilePromptResponse;
  };
}
