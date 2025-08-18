import {
  EvaluationRequest,
  LLMMessage
} from '../../types';
import { CanonicalEvaluationStrategy } from '../canonical';

export class OpenAICanonicalEvaluationStrategy
  implements CanonicalEvaluationStrategy {
  convertToQualifireEvaluationRequest(
    request: any,
    response: any
  ): EvaluationRequest {
    // chat completions api
    let messages: LLMMessage[] = [];
    
    if (request?.messages) {
      for (const message of request.messages) {
        if (message.role && message.content) {
        messages.push({
            role: message.role,
            content: message.content,
          });
        } else {
          throw new Error("Invalid request: " + JSON.stringify(message));
        }
      }
    }

    // chat completions api
    if (response?.choices) {
      for (const choice of response.choices) {
        if (choice.message?.role && choice.message?.content) {
          messages.push({
            role: choice.message.role,
            content: choice.message.content,
          });
        } else {
          throw new Error("Invalid response: " + JSON.stringify(choice));
        }
      }
    }

    //response api
    if (response.output) {
      for (const outputElement of response.output) {
        if (outputElement.type === 'message' && outputElement.content) {
          for (const contentElement of outputElement.content) {
            if (contentElement.type === 'text' && contentElement.text) {
              messages.push({
                  role: outputElement.role,
                  content: contentElement.text,
                });
            } else {
              throw new Error("Invalid output: " + JSON.stringify(contentElement));
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
    throw new Error("Invalid request or response");
  }
}
