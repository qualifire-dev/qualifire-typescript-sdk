import {
  EvaluationProxyAPIRequest,
  LLMMessage,
  LLMToolCall,
  LLMToolDefinition,
} from '../../types';
import { CanonicalEvaluationStrategy } from '../canonical';

export class GeminiAICanonicalEvaluationStrategy
  implements CanonicalEvaluationStrategy<any, any> {
  async convertToQualifireEvaluationRequest(
    request: any,
    response: any
  ): Promise<EvaluationProxyAPIRequest> {
    let {
      messages: requestMessages,
      available_tools: requestAvailableTools,
    } = await this.convertRequest(request);

    const messages: LLMMessage[] = requestMessages || [];
    const available_tools: LLMToolDefinition[] = requestAvailableTools || [];

    if (Array.isArray(response)) {
      let streamingResultMessages = await this.handleStreaming(response);
      messages.push(...streamingResultMessages);
    } else {
      let nonStreamingResultMessages = await this.handleNonStreamingResponse(
        response
      );
      messages.push(...nonStreamingResultMessages);
    }

    return {
      messages,
      available_tools,
    };
  }

  async convertRequest(request: any): Promise<EvaluationProxyAPIRequest> {
    const messages: LLMMessage[] = [];
    const available_tools: LLMToolDefinition[] = [];

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

    return {
      messages,
      available_tools,
    };
  }

  private async handleResponse(response: any): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    // Handle response candidates
    if (response?.candidates) {
      for (const candidate of response.candidates) {
        if (candidate.content?.role && candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            const message = convertPartToLLMMessage(
              part,
              candidate.content.role
            );
            if (message) {
              messages.push(message);
            }
          }
        }
      }
    }

    return messages;
  }

  private async handleStreaming(response: any[]): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];
    let accumulatedText = '';
    let currentRole = '';

    for (const chunk of response) {
      if (chunk?.candidates && chunk.candidates.length > 0) {
        const candidate = chunk.candidates[0];

        // Check if role has changed
        if (candidate.content?.role && candidate.content.role !== currentRole) {
          // If we have accumulated text and role changed, create a message
          if (accumulatedText && currentRole) {
            const role = currentRole === 'model' ? 'assistant' : currentRole;
            messages.push({
              role,
              content: accumulatedText.trim(),
            });
          }
          // Reset for new role
          accumulatedText = '';
          currentRole = candidate.content.role;
        }

        // Accumulate text from parts
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.text) {
              accumulatedText += part.text;
            }
          }
        }
      }
    }

    // Add final accumulated message if we have content
    if (accumulatedText && currentRole) {
      const role = currentRole === 'model' ? 'assistant' : currentRole;
      messages.push({
        role,
        content: accumulatedText.trim(),
      });
    }

    return messages;
  }

  private async handleNonStreamingResponse(
    response: any
  ): Promise<LLMMessage[]> {
    // // Handle nested response structure (VertexAI format)
    // if (response?.response?.candidates) {
    //   return this.handleResponse(response.response);
    // }
    // Handle direct candidates structure
    return this.handleResponse(response);
  }
}

// Helper function to convert a Gemini part to LLMMessage
function convertPartToLLMMessage(
  part: any,
  defaultRole: string
): LLMMessage | null {
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
    tool_calls = [
      {
        name: part.functionCall.name,
        arguments: part.functionCall.args,
        id: `gemini_${Date.now()}_${Math.random()}`, // Generate unique ID
      },
    ];
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
