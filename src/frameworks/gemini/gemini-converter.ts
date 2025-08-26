import {
  EvaluationProxyAPIRequest,
  LLMMessage,
  LLMToolCall,
  LLMToolDefinition,
} from '../../types';
import { CanonicalEvaluationStrategy } from '../canonical';

type GeminiAICanonicalEvaluationStrategyResponse = any;
type GeminiAICanonicalEvaluationStrategyRequest = any;

export class GeminiAICanonicalEvaluationStrategy
  implements
    CanonicalEvaluationStrategy<
      GeminiAICanonicalEvaluationStrategyRequest,
      GeminiAICanonicalEvaluationStrategyResponse
    > {
  async convertToQualifireEvaluationRequest(
    request: GeminiAICanonicalEvaluationStrategyRequest,
    response: GeminiAICanonicalEvaluationStrategyResponse
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

  async convertRequest(
    request: GeminiAICanonicalEvaluationStrategyRequest
  ): Promise<EvaluationProxyAPIRequest> {
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
        if (content.parts && content.parts.length > 0) {
          const message = convertContentToLLMMessage(content);
          if (message) {
            messages.push(message);
          }
        }
      }
    }

    return {
      messages,
      available_tools,
    };
  }

  private async handleResponse(
    response: GeminiAICanonicalEvaluationStrategyResponse
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    // Handle response candidates
    if (response?.candidates) {
      for (const candidate of response.candidates) {
        if (
          candidate.content?.role &&
          candidate.content?.parts &&
          candidate.content.parts.length > 0
        ) {
          const message = convertContentToLLMMessage(candidate.content);
          if (message) {
            messages.push(message);
          }
        }
      }
    }

    return messages;
  }

  private async handleStreaming(
    response: GeminiAICanonicalEvaluationStrategyResponse
  ): Promise<LLMMessage[]> {
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
    response: GeminiAICanonicalEvaluationStrategyResponse
  ): Promise<LLMMessage[]> {
    // // Handle nested response structure (VertexAI format)
    // if (response?.response?.candidates) {
    //   return this.handleResponse(response.response);
    // }
    // Handle direct candidates structure
    return this.handleResponse(response);
  }
}

// Helper function to convert a Gemini content object (with multiple parts) to LLMMessage
function convertContentToLLMMessage(content: any): LLMMessage | null {
  if (!content.parts || content.parts.length === 0) {
    return null;
  }

  let role = content.role;
  let textContent: string[] = [];
  let tool_calls: LLMToolCall[] = [];
  let toolResponseContent: string[] = [];
  let hasValidContent = false;

  // Process all parts and aggregate them
  for (const part of content.parts) {
    if (part.text) {
      hasValidContent = true;
      textContent.push(part.text);
    }

    if (part.functionCall) {
      hasValidContent = true;
      role = 'assistant'; // Function calls are always from assistant
      tool_calls.push({
        name: part.functionCall.name,
        arguments: part.functionCall.args,
        id: `gemini_${Date.now()}_${Math.random()}`, // Generate unique ID
      });
    }

    if (part.functionResponse) {
      hasValidContent = true;
      role = 'tool';
      toolResponseContent.push(
        JSON.stringify(part.functionResponse.response?.result)
      );
    }

    if (part.thoughtSignature) {
      hasValidContent = true;
      // Handle thought signature parts (internal reasoning)
      // These are typically not meant for end users, so we can skip them
    }
  }

  if (!hasValidContent) {
    return null;
  }

  // Determine final role
  const finalRole = role === 'model' ? 'assistant' : role;

  // Aggregate content based on message type
  let finalContent: string | undefined;
  if (textContent.length > 0) {
    finalContent = textContent.join(' ');
  } else if (toolResponseContent.length > 0) {
    finalContent = toolResponseContent.join(' ');
  }

  return {
    role: finalRole,
    content: finalContent,
    tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
  };
}
