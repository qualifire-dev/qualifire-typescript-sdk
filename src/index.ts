import {
  EvaluationResponse,
  Input,
  Output,
  evaluationResponseSchema,
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
      baseUrl ||
      process.env.QUALIFIRE_BASE_URL ||
      'https://gateway.qualifire.ai';

    if (!key) {
      throw new Error(
        'Missing SDK key, please provide an arg or add the QUALIFIRE_API_KEY environment variable.'
      );
    }

    this.sdkKey = key;
    this.baseUrl = qualifireBaseUrl;
  }

  evaluate = async (
    input: Input,
    output: Output,
    {
      async,
    }: {
      async?: boolean;
    } = {}
  ): Promise<EvaluationResponse | undefined> => {
    const url = `${this.baseUrl}/api/evaluation/v1`;
    const body = JSON.stringify({ async, input, output });
    const headers = {
      'Content-Type': 'application/json',
      'X-qualifire-key': this.sdkKey,
    };
    if (async) {
      void fetch(url, {
        method: 'POST',
        headers,
        body,
      });
    } else {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        throw new Error(`Qualifire API error: ${response.statusText}`);
      }

      const jsonResponse = await response.json();

      const parsed = evaluationResponseSchema.safeParse(jsonResponse);
      if (!parsed.success) {
        throw new Error('Qualifire API error: Evaluation failed');
      }

      return parsed.data;
    }
  };
}
