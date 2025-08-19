import {
  EvaluationRequest,
  LLMMessage,
  LLMToolDefinition
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

export function convertToolsToLLMDefinitions(tools: unknown[]): LLMToolDefinition[] {
  const results: LLMToolDefinition[] = [];
  
  for (const tool of tools) {
    // Check if it's a valid tool object
    if (!tool || typeof tool !== 'object') {
      continue;
    }
    
    const toolObj = tool as any;
    
    // Handle FunctionTool type
    if (toolObj.type === 'function' && toolObj.function) {
      const functionDef = toolObj.function;
      
      const llmTool: LLMToolDefinition = {
        name: functionDef.name || 'unnamed_function',
        description: functionDef.description || 'No description provided',
        parameters: functionDef.parameters || {}
      };
      
      results.push(llmTool);
    }
    
    // Handle other tool types that might have different structures
    else if (toolObj.name && typeof toolObj.name === 'string') {
      // Generic tool with name property
      const llmTool: LLMToolDefinition = {
        name: toolObj.name,
        description: toolObj.description || 'No description provided',
        parameters: toolObj.parameters || toolObj.args || {}
      };
      
      results.push(llmTool);
    }
    
    // Handle Vercel AI SDK tool format
    else if (toolObj.description && toolObj.parameters) {
      // Extract name from tool (might need to be provided or generated)
      const name = toolObj.name || `tool_${results.length}`;
      
      const llmTool: LLMToolDefinition = {
        name: name,
        description: toolObj.description,
        parameters: toolObj.parameters
      };
      
      results.push(llmTool);
    }
  }
  
  return results;
}
