import {
  EvaluationRequest,
  LLMMessage,
  LLMToolCall,
  LLMToolDefinition
} from '../../types';
import { CanonicalEvaluationStrategy, convertToolsToLLMDefinitions, convertResponseMessagesToLLMMessages } from '../canonical';

export class OpenAICanonicalEvaluationStrategy
  implements CanonicalEvaluationStrategy {
  async convertToQualifireEvaluationRequest(
    request: any,
    response: any
  ): Promise<EvaluationRequest> {
    // chat completions api
    let messages: LLMMessage[] = [];
    
    if (request?.instructions) {
      messages.push({
        role: "system",
        content: request.instructions,
      });
    }

    if (request?.input) {
      if (typeof request.input === 'string') {
        messages.push({
          role: "user",
          content: request.input,
        });
      } else {
        messages.push(...convertResponseMessagesToLLMMessages(request.input));
      }
    }

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
      messages.push(...convertResponseMessagesToLLMMessages(response.output));
    }

    let available_tools: LLMToolDefinition[] = [];
    if (request?.tools) {
      available_tools = convertToolsToLLMDefinitions(request?.tools);
    }
    return {
      messages,
      available_tools,
    };
  }
}



