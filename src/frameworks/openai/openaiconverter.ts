import {
  EvaluationRequest,
  LLMMessage,
  LLMToolDefinition
} from '../../types';
import { CanonicalEvaluationStrategy, convertToolsToLLMDefinitions } from '../canonical';

export class OpenAICanonicalEvaluationStrategy
  implements CanonicalEvaluationStrategy {
  async convertToQualifireEvaluationRequest(
    request: any,
    response: any
  ): Promise<EvaluationRequest> {
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
        switch (outputElement.type) {
          case 'message':
            if (outputElement.content) {
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
            break;
          // function calls based on https://platform.openai.com/docs/api-reference/responses/create
          case 'web_search_call':
            messages.push({
              role: "assistant" as const,
              tool_calls: [{
              name: outputElement.name,
                arguments: {},
                id: outputElement.id,
              }],
            });
            break;
          case 'file_search_call':
            let toolArguments = outputElement.queries? {"queries": outputElement?.queries} : {};
            messages.push({
              role: "assistant" as const,
              tool_calls: [{
              name: outputElement.name,
              arguments: toolArguments,
              id: outputElement.id,
              }],
            });
            break;
          case 'function_call': 
            messages.push({
              role: "assistant" as const,
              tool_calls: [{
              name: outputElement.name,
              arguments: JSON.parse(outputElement.arguments),
              id: outputElement.id,
              }],
            });
            break;
        }
      }
    }

    let available_tools: LLMToolDefinition[] = convertToolsToLLMDefinitions(request?.tools);
    return {
      messages: messages,
      available_tools: available_tools,
    };
  }
}
