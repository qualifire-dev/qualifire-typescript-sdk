import * as traceloop from '@traceloop/node-server-sdk';
import { ClaudeCanonicalEvaluationStrategy } from './frameworks/claude/claude-converter';
import { GeminiAICanonicalEvaluationStrategy } from './frameworks/gemini/gemini-converter';
import { OpenAICanonicalEvaluationStrategy } from './frameworks/openai/openai-converter';
import { VercelAICanonicalEvaluationStrategy } from './frameworks/vercelai/vercelai-converter';
import { EvaluationProxyAPIRequest, EvaluationProxyAPIRequestSchema, EvaluationRequestV2Schema, type EvaluationRequestV2, type EvaluationResponse, type Framework } from './types';
import { CanonicalEvaluationStrategy } from './frameworks/canonical';

export type {
  EvaluationRequestV2,
  EvaluationProxyAPIRequest,
  EvaluationResponse, Framework, LLMMessage
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
   *  dangerousContentCheck: true,
   *  groundingCheck: true,
   *  hallucinationsCheck: true,
   *  harassmentCheck: true,
   *  hateSpeechCheck: true,
   *  instructionsFollowingCheck: true,
   *  piiCheck: true,
   *  promptInjections: true,
   *  sexualContentCheck: true,
   *  toolSelectionQualityCheck: false,
   * });
   * 
   * // Fine-grained messages mode
   * const response2 = await qualifire.evaluate({
   *   messages: [
   *     { role: 'user', content: 'What is the capital of France?' },
   *     { role: 'assistant', content: 'Paris' }
   *   ],
   *   dangerousContentCheck: true,
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
   *          "reason": "The AI's output provides a detailed scientific explanation for why the sky is blue, which is a direct answer to the user's question. While the prompt itself doesn't contain the information about Rayleigh scattering or light wavelengths, the AI's role as a 'helpful assistant that can answer questions' implies it should provide accurate and relevant information. The claims are inferable as they are a logical and scientifically accurate expansion on the simple 'yes' or 'no' implied by the question, providing the 'why' behind the sky's color."
   *        }
   *      ]
   *    }
   *  ]
   * }
   */
  evaluate = async (evaluationRequest: EvaluationProxyAPIRequest | EvaluationRequestV2): Promise<EvaluationResponse | undefined> => {
    // If messages are provided directly, use them as-is without conversion
    const parseEvaluationProxyAPIRequest = EvaluationProxyAPIRequestSchema.safeParse(evaluationRequest)
    if (parseEvaluationProxyAPIRequest.success) {
      return this.evaluateWithBackwardCompatibility(parseEvaluationProxyAPIRequest.data as EvaluationProxyAPIRequest);
    }

    const parseEvaluationRequestResultV2 = EvaluationRequestV2Schema.safeParse(evaluationRequest)
    if (parseEvaluationRequestResultV2.success) {
      return this.evaluateWithConverters(parseEvaluationRequestResultV2.data );
    }
    
    throw new Error(`Invalid evaluation request format: ${JSON.stringify(evaluationRequest)}`);
  };

  /**
   * Evaluates using direct messages without conversion (overrides request/response if both are provided)
   */
  private evaluateWithBackwardCompatibility = async (evaluationProxyAPIRequest: EvaluationProxyAPIRequest): Promise<EvaluationResponse | undefined> => {
    const url = `${this.baseUrl}/api/evaluation/evaluate`;
    const body = {
      input: evaluationProxyAPIRequest.input,
      output: evaluationProxyAPIRequest.output,
      messages: evaluationProxyAPIRequest.messages,
      available_tools: evaluationProxyAPIRequest.available_tools,
      dangerous_content_check: evaluationProxyAPIRequest.dangerous_content_check || evaluationProxyAPIRequest.dangerousContentCheck,
      grounding_check: evaluationProxyAPIRequest.grounding_check || evaluationProxyAPIRequest.groundingCheck,
      hallucinations_check: evaluationProxyAPIRequest.hallucinations_check || evaluationProxyAPIRequest.hallucinationsCheck,
      harassment_check: evaluationProxyAPIRequest.harassment_check || evaluationProxyAPIRequest.harassmentCheck,
      hate_speech_check: evaluationProxyAPIRequest.hate_speech_check || evaluationProxyAPIRequest.hateSpeechCheck,
      instructions_following_check: evaluationProxyAPIRequest.instructions_following_check || evaluationProxyAPIRequest.instructionsFollowingCheck,
      pii_check: evaluationProxyAPIRequest.pii_check || evaluationProxyAPIRequest.piiCheck,
      prompt_injections: evaluationProxyAPIRequest.prompt_injections || evaluationProxyAPIRequest.promptInjections,
      sexual_content_check: evaluationProxyAPIRequest.sexual_content_check || evaluationProxyAPIRequest.sexualContentCheck,
      syntax_checks: evaluationProxyAPIRequest.syntax_checks || evaluationProxyAPIRequest.syntaxChecks,
      tool_selection_quality_check: evaluationProxyAPIRequest.tool_selection_quality_check || evaluationProxyAPIRequest.toolSelectionQualityCheck,
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
  private evaluateWithConverters = async (EvaluationRequestV2: EvaluationRequestV2): Promise<EvaluationResponse | undefined> => {
    const frameworkConverters: Record<Framework, () => CanonicalEvaluationStrategy<any, any>> = {
      'openai': () => new OpenAICanonicalEvaluationStrategy(),
      'vercelai': () => new VercelAICanonicalEvaluationStrategy(),
      'gemini': () => new GeminiAICanonicalEvaluationStrategy(),
      'claude': () => new ClaudeCanonicalEvaluationStrategy(),
    };

    const supportedFrameworks = Object.keys(frameworkConverters);
    const converterFactory = frameworkConverters[EvaluationRequestV2.framework];
    
    if (!converterFactory) {
      throw new Error(`Unsupported framework: ${EvaluationRequestV2.framework}. Supported frameworks: ${supportedFrameworks.join(', ')}`);
    }

    const requestConverter = converterFactory();

    
    const evaluationRequest = await requestConverter.convertToQualifireEvaluationRequest(EvaluationRequestV2.request, EvaluationRequestV2.response)

    const url = `${this.baseUrl}/api/evaluation/evaluate`;
    const body = {
      messages: evaluationRequest.messages,
      available_tools: evaluationRequest.available_tools,
      dangerous_content_check: EvaluationRequestV2.dangerousContentCheck,
      grounding_check: EvaluationRequestV2.groundingCheck,
      hallucinations_check: EvaluationRequestV2.hallucinationsCheck,
      harassment_check: EvaluationRequestV2.harassmentCheck,
      hate_speech_check: EvaluationRequestV2.hateSpeechCheck,
      instructions_following_check: EvaluationRequestV2.instructionsFollowingCheck,
      pii_check: EvaluationRequestV2.piiCheck,
      prompt_injections: EvaluationRequestV2.promptInjections,
      sexual_content_check: EvaluationRequestV2.sexualContentCheck,
      syntax_checks: EvaluationRequestV2.syntaxChecks,
      tool_selection_quality_check: EvaluationRequestV2.toolSelectionQualityCheck,
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
}
