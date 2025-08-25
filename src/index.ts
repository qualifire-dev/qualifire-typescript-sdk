import * as traceloop from '@traceloop/node-server-sdk';
import { ClaudeCanonicalEvaluationStrategy } from './frameworks/claude/claude-converter';
import { GeminiAICanonicalEvaluationStrategy } from './frameworks/gemini/gemini-converter';
import { OpenAICanonicalEvaluationStrategy } from './frameworks/openai/openai-converter';
import { VercelAICanonicalEvaluationStrategy } from './frameworks/vercelai/vercelai-converter';
import { EvaluationRequestV1, type EvaluationRequestV2, type EvaluationResponse, type Framework } from './types';

export type {
  EvaluationRequestV2,
  EvaluationRequestV1,
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
   * 1. Direct messages mode: If `messages` are provided, they are sent as-is to the proxy without conversion
   * 2. Framework converter mode: If `request` and `response` are provided, they are converted using the specified framework converter
   * 
   * Note: If both `messages` and `request`/`response` are provided, `messages` takes precedence.
   *
   * @param EvaluationRequestV2 - The evaluation request with either direct messages or framework-specific request/response
   * @returns An object containing the evaluation results.
   *
   * @example
   * ```ts
   * const qualifire = new Qualifire();
   * 
   * // Direct messages mode (no conversion)
   * const response1 = await qualifire.evaluate({
   *   framework: 'openai',
   *   messages: [
   *     { role: 'user', content: 'What is the capital of France?' },
   *     { role: 'assistant', content: 'Paris' }
   *   ],
   *   assertions: ['capital'],
   *   dangerousContentCheck: true,
   *   hallucinationsCheck: true,
   * });
   * 
   * // Framework converter mode
   * const response2 = await qualifire.evaluate({
   *   framework: 'openai',
   *   request: openaiRequest,
   *   response: openaiResponse,
   *   assertions: ['capital'],
   *   dangerousContentCheck: true,
   *   hallucinationsCheck: true,
   * });
   * ```
   */
  evaluate = async (EvaluationRequestV2: EvaluationRequestV2): Promise<EvaluationResponse | undefined> => {
    // If messages are provided directly, use them as-is without conversion
    if (EvaluationRequestV2.messages && EvaluationRequestV2.messages.length > 0) {
      return this.evaluateWithBackwardCompatibility(EvaluationRequestV2);
    }

    // Use framework converters for request/response
    return this.evaluateWithConverters(EvaluationRequestV2);
  };

  /**
   * Evaluates using direct messages without conversion (overrides request/response if both are provided)
   */
  private evaluateWithBackwardCompatibility = async (EvaluationRequestV2: EvaluationRequestV2): Promise<EvaluationResponse | undefined> => {
    const url = `${this.baseUrl}/api/evaluation/evaluate`;
    const body = {
      input: EvaluationRequestV2.input,
      output: EvaluationRequestV2.output,
      messages: EvaluationRequestV2.messages,
      available_tools: EvaluationRequestV2.available_tools,
      dangerous_content_check: EvaluationRequestV2.dangerous_content_check,
      grounding_check: EvaluationRequestV2.grounding_check ,
      hallucinations_check: EvaluationRequestV2.hallucinations_check,
      harassment_check: EvaluationRequestV2.harassment_check,
      hate_speech_check: EvaluationRequestV2.hate_speech_check,
      instructions_following_check: EvaluationRequestV2.instructions_following_check,
      pii_check: EvaluationRequestV2.pii_check,
      prompt_injections: EvaluationRequestV2.prompt_injections,
      sexual_content_check: EvaluationRequestV2.sexual_content_check,
      syntax_checks: EvaluationRequestV2.syntax_checks,
      tool_selection_quality_check: EvaluationRequestV2.tool_selection_quality_check,
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
   * Evaluates using framework converters for request/response
   */
  private evaluateWithConverters = async (EvaluationRequestV2: EvaluationRequestV2): Promise<EvaluationResponse | undefined> => {
    const frameworkConverters: Record<Framework, () => any> = {
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

    
    let evaluationRequest = await requestConverter.convertToQualifireEvaluationRequest(EvaluationRequestV2.request, EvaluationRequestV2.response)

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
