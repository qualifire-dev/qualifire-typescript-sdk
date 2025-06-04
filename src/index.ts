import { EvaluationRequestSchema, type EvaluationRequest, type EvaluationResponse } from './types';
import * as traceloop from '@traceloop/node-server-sdk';

export { EvaluationRequest, EvaluationResponse } from './types';

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
   * @param apiKey - The API key for the Qualifire SDK.   * @param baseUrl - The base URL for the Qualifire API.
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

  init() {
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
   * @param request - The EvaluationRequest to send.
   * @returns An object containing the evaluation results.
   *
   * @example
   * ```ts
   * const qualifire = new Qualifire();
   * const response = await qualifire.evaluate({
   *   input: 'What is the capital of France?',
   *   output: 'Paris',
   *   assertions: ['capital'],
   *   consistencyCheck: true,
   *   dangerousContentCheck: true,
   *   hallucinationsCheck: true,
   *   harassmentCheck: true,
   *   hateSpeechCheck: true,
   *   piiCheck: true,
   *   promptInjections: true,
   *   sexualContentCheck: true,
   * });
   * ```
   */
  evaluate = async (
    request: EvaluationRequest
  ): Promise<EvaluationResponse | undefined> => {
    const parsedRequest = EvaluationRequestSchema.parse(request)

    const url = `${this.baseUrl}/api/evaluation/evaluate`;
    const body = JSON.stringify(parsedRequest);

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
