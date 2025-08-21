import {
  EvaluationRequest,
  LLMMessage,
  LLMToolDefinition
} from '../../types';
import { CanonicalEvaluationStrategy, convertResponseMessagesToLLMMessages, convertToolsToLLMDefinitions } from '../canonical';

export class OpenAICanonicalEvaluationStrategy
  implements CanonicalEvaluationStrategy {
  async convertToQualifireEvaluationRequest(
    request: any,
    response: any
  ): Promise<EvaluationRequest> {
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
        if (choice.message?.role) {
          let message: LLMMessage = {
            role: choice.message.role,
          }
          if (choice.message?.content) {
            message.content = choice.message.content;
          }
          if (choice.message?.tool_calls) {
            message.tool_calls = choice.message.tool_calls.map((tool_call: any) => ({
              name: tool_call.function.name,
              arguments: JSON.parse(tool_call.function.arguments),
              id: tool_call.id,
            }));
          }
          if (message.content || message.tool_calls) {
            messages.push(message); 
          } else {
            throw new Error("Invalid response: " + JSON.stringify(choice));
          }
        }
      }
    }

    //response api
    if (response.output) {
      messages.push(...convertResponseMessagesToLLMMessages(response.output));
    } else if (response.sequence_number && response.type == 'response.completed') {
      // For streaming responses
      if (response.response?.output) {
        messages.push(...convertResponseMessagesToLLMMessages(response.response.output));
      } else {
        throw new Error("Invalid response: " + JSON.stringify(response));
      }
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



