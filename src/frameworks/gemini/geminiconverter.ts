import {
  EvaluationRequest,
  LLMMessage
} from '../../types';
import { CanonicalEvaluationStrategy } from '../canonical';

export class GeminiAICanonicalEvaluationStrategy
  implements CanonicalEvaluationStrategy {
  convertToQualifireEvaluationRequest(
    request: any,
    response: any
  ): EvaluationRequest {
    let messages: LLMMessage[] = [];
    
    if (typeof request === 'string') {
        messages.push({
            role: 'user',
            content: request,
        });
    } else if (request?.message) {
        messages.push({
            role: 'user',
            content: request.message,
        });
    }

    // VertexAI response contains a response inside the response object.
    if (response?.response?.candidates) {
      response = response.response;
    }

    // Handle Gemini response messages
    if (response?.candidates) {
      for (const candidate of response.candidates) {
        if (candidate.content?.role && candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.text) {
                messages.push({
                    role: candidate.content.role,
                    content: part.text,
                });
            } else {
                throw new Error("Invalid Gemini request: " + JSON.stringify(part));
            }
          }
        }
      }
    }

    if (messages.length > 0) {
      return {
        messages: messages,
      };
    }
    throw new Error("Invalid Gemini request or response");
  }
}
