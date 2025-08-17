import {
  EvaluationRequest,
  OpenAIResponse,
  OpenAIResponseRequest,
  OpenAIResponseRequestSchema,
  OpenAIResponseSchema,
} from '../../types';
import { CanonicalEvaluationStrategy } from '../canonical';

export class OpenAICanonicalEvaluationStrategy
  implements CanonicalEvaluationStrategy {
  convertToQualifireEvaluationRequest(
    request: any,
    response: any
  ): EvaluationRequest {
    // Use Zod to validate the request structure
    const validatedRequest: OpenAIResponseRequest = OpenAIResponseRequestSchema.parse(
      request
    );
    const validatedResponse: OpenAIResponse = OpenAIResponseSchema.parse(
      response
    );

    const qualifireRequest: EvaluationRequest = {
      input: validatedRequest.input,
      output: validatedResponse.output_text,
      messages: validatedResponse.messages,
    };

    return qualifireRequest;
  }
}
