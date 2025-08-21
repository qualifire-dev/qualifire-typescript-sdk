import {
  EvaluationRequest,
  LLMMessage,
  LLMToolCall,
  LLMToolDefinition,
} from '../../types';
import { CanonicalEvaluationStrategy } from '../canonical';

export class GeminiAICanonicalEvaluationStrategy
  implements CanonicalEvaluationStrategy {
  async convertToQualifireEvaluationRequest(
    request: any,
    response: any
  ): Promise<EvaluationRequest> {
    let messages: LLMMessage[] = [];
    let available_tools: LLMToolDefinition[] = [];
    
    // Handle available tools
    if (request?.config?.tools && request.config.tools.length > 0) {
      for (const tool of request.config.tools) {
        if (tool.functionDeclarations && tool.functionDeclarations.length > 0) {
          for (const functionDeclaration of tool.functionDeclarations) {
            available_tools.push({
              name: functionDeclaration.name,
              description: functionDeclaration.description,
              parameters: functionDeclaration.parameters.properties,
            });
          }
        }
      }
    }

    // Handle request contents
    if (request?.contents) {
      for (const content of request.contents) {
        if (content.parts) {
          for (const part of content.parts) {
            const message = convertPartToLLMMessage(part, content.role);
            if (message) {
              messages.push(message);
            }
          }
        }
      }
    }

    // VertexAI response contains a response inside the response object.
    if (response?.response?.candidates) {
      response = response.response;
    }

    // Handle response candidates
    if (response?.candidates) {
      for (const candidate of response.candidates) {
        if (candidate.content?.role && candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            const message = convertPartToLLMMessage(part, candidate.content.role);
            if (message) {
              messages.push(message);
            }
          }
        }
      }
    }

    return {
      messages,
      available_tools,
    };
  }
}

// Helper function to convert a Gemini part to LLMMessage
function convertPartToLLMMessage(part: any, defaultRole: string): LLMMessage | null {
  let role = defaultRole;
  let content: string | undefined;
  let tool_calls: LLMToolCall[] = [];
  let validMessage = false;

  if (part.text) {
    validMessage = true;
    // Handle text parts
    role = role === 'model' ? 'assistant' : role;
    content = part.text;
  }
  
  if (part.functionCall) {
    validMessage = true;
    // Handle function call parts
    role = 'assistant';
    tool_calls = [{
      name: part.functionCall.name,
      arguments: part.functionCall.args,
      id: `gemini_${Date.now()}_${Math.random()}`, // Generate unique ID
    }];
  }
  
  if (part.functionResponse) {
    validMessage = true;
    role = 'tool';
    content = JSON.stringify(part.functionResponse.response?.result);
  }
  
  if (part.thoughtSignature) {
    // Handle thought signature parts (internal reasoning)
    // These are typically not meant for end users, so we can skip them
    validMessage = true;
  }

  if (!validMessage) {
    console.warn('Unhandled Gemini response part type:', part);
    return null;
  }

  return {
    role,
    content,
    tool_calls,
  };
}
