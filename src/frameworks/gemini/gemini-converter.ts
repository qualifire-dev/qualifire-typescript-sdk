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
    const {
      messages: requestMessages,
      available_tools: requestAvailableTools,
    } = await this.convertRequest(request);

    const messages: LLMMessage[] = requestMessages || [];
    const available_tools: LLMToolDefinition[] = requestAvailableTools || [];

    if (Array.isArray(response)) {
      const streamingResultMessages = await this.handleStreaming(response);
      messages.push(...streamingResultMessages);
    } else {
      const nonStreamingResultMessages = await this.handleNonStreamingResponse(
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
              parameters: functionDeclaration.parameters,
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
    if (response?.candidates && response.candidates.length > 0) {
      if (response.candidates.length > 1) {
        console.debug(
          'Multiple candidates found in the response. Only first candidate is supported.'
        );
      }

      const firstCandidate = response.candidates[0];
      if (
        firstCandidate.content?.role &&
        firstCandidate.content?.parts &&
        firstCandidate.content.parts.length > 0
      ) {
        const message = convertContentToLLMMessage(firstCandidate.content);
        if (message) {
          messages.push(message);
        }
      }
    }

    return messages;
  }

  private async handleStreaming(
    response: GeminiAICanonicalEvaluationStrategyResponse
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    let accumulatedText: string[] = [];
    let currentRole = 'assistant';

    for (const chunk of response) {
      if (chunk?.candidates && chunk.candidates.length > 0) {
        if (chunk.candidates.length > 1) {
          console.debug(
            'Multiple candidates found in the response. Only first candidate is supported.'
          );
        }
        const firstCandidate = chunk.candidates[0]; // we currently only support one response message

        if (firstCandidate.content?.role) {
          currentRole = firstCandidate.content.role;
          if (currentRole === 'model') {
            currentRole = 'assistant'; // Answers returned from the model are always from the assistant role
          }
        }

        if (!firstCandidate.content) {
          console.debug(
            'Content is missing required fields. Skipping message.'
          );
          continue;
        }

        const message = convertContentToLLMMessage(firstCandidate.content);
        if (message?.content) {
          accumulatedText.push(message.content);
        }
      }
    }

    if (accumulatedText) {
      messages.push({
        role: currentRole,
        content: accumulatedText.join('').trim(),
      });
    }

    return messages;
  }

  private async handleNonStreamingResponse(
    response: GeminiAICanonicalEvaluationStrategyResponse
  ): Promise<LLMMessage[]> {
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

  // Process all parts and aggregate them
  for (const part of content.parts) {
    if (part.text) {
      textContent.push(part.text);
    } else if (part.functionCall) {
      role = 'assistant'; // Function calls are always from assistant
      tool_calls.push({
        name: part.functionCall.name,
        arguments: part.functionCall.args,
      });
    } else if (part.functionResponse?.response?.result) {
      role = 'tool';
      textContent.push(JSON.stringify(part.functionResponse.response?.result));
    }
  }

  // Determine final role
  const finalRole = role === 'model' ? 'assistant' : role;

  // Aggregate content based on message type
  let finalContent: string | undefined;
  if (textContent.length > 0) {
    finalContent = textContent.join(' ');
  }

  return {
    role: finalRole,
    content: finalContent,
    tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
  };
}
