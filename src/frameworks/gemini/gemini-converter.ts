import { Content, ContentListUnion, Part } from '@google/genai';
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

    // Avoid undefined response
    if (!response) {
      return {
        messages,
        available_tools,
      };
    }

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

    let contents: Array<Content> = [];
    if (request?.config?.systemInstruction) {
      /*
        Gemini request.contents is an object called contentListUnions which can be
        list of parts or content objects:
        https://github.com/googleapis/js-genai/blob/b5d77e1bfea5c6b4903bc7ade986e91d6e146835/src/types.ts#L1937
      */
      const convertedSystemContent = convertContentListUnionsToContentList(
        request.config.systemInstruction,
        'system'
      );

      if (convertedSystemContent.length != 1) {
        throw new Error(
          `Invalid system instruction given. Gemini Does not support multiple system instructions: ${JSON.stringify(
            request.contents
          )}`
        );
      }

      contents.push(convertedSystemContent[0]);
    }

    // Handle request contents
    if (request?.contents) {
      const convertedContents = convertContentListUnionsToContentList(
        request.contents,
        'user'
      );

      contents.push(...convertedContents);
    }

    for (const content of contents) {
      const message = convertContentToLLMMessage(content);
      if (message) {
        messages.push(message);
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
        const message = convertContentToLLMMessage(
          firstCandidate.content as Content
        );
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

    let accumulatedContentParts: string[] = [];
    let currentRole = 'assistant';
    let toolCalls: LLMToolCall[] = [];
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

        const message = convertContentToLLMMessage(
          firstCandidate.content as Content
        );
        if (message?.content) {
          accumulatedContentParts.push(message.content);
        }
        if (message?.tool_calls) {
          toolCalls.push(...message.tool_calls);
        }
      }
    }

    const accumulatedContent =
      accumulatedContentParts.length > 0
        ? accumulatedContentParts.join('').trim()
        : undefined;
    if (accumulatedContent || toolCalls.length > 0) {
      messages.push({
        role: currentRole,
        content: accumulatedContent,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
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

  // In Gemini role is optional, but by default the api is changing it to 'user' when no role is provided
  let role = content.role || 'user';
  let textContent: string[] = [];
  let tool_calls: LLMToolCall[] = [];

  // Process all parts and aggregate them
  for (const part of content.parts) {
    if (typeof part === 'string') {
      textContent.push(part);
    } else if (part.text) {
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

function isPartOrString(obj: unknown): boolean {
  if (typeof obj === 'string') {
    return true;
  }
  if (typeof obj === 'object' && obj !== null) {
    return (
      'fileData' in obj ||
      'text' in obj ||
      'functionCall' in obj ||
      'functionResponse' in obj ||
      'inlineData' in obj ||
      'videoMetadata' in obj ||
      'codeExecutionResult' in obj ||
      'executableCode' in obj
    );
  }
  return false;
}

function isContent(obj: unknown): boolean {
  if (typeof obj === 'object' && obj !== null) {
    return 'parts' in obj || 'role' in obj;
  }
  return false;
}

function convertContentListUnionsToContentList(
  input: Array<ContentListUnion> | ContentListUnion,
  defaultRole: string
): Array<Content> {
  /*
      Gemini request.contents is an object called contentListUnions which can be
      list of parts or content objects:
      https://github.com/googleapis/js-genai/blob/b5d77e1bfea5c6b4903bc7ade986e91d6e146835/src/types.ts#L1937
    */

  let inputs: Array<ContentListUnion>;
  if (!Array.isArray(input)) {
    inputs = [input];
  } else {
    inputs = input;
  }

  if (inputs.length === 0) {
    return [];
  }

  let convertedContents: Array<Content> = [];
  if (inputs.every(isContent)) {
    convertedContents = inputs as Array<Content>;
  } else if (inputs.every(isPartOrString)) {
    let partInputs: Array<Part> = [];
    for (const partOrString of inputs) {
      if (typeof partOrString === 'string') {
        partInputs.push({ text: partOrString });
      } else {
        partInputs.push(partOrString as Part);
      }
    }
    convertedContents.push({
      role: defaultRole,
      parts: partInputs,
    });
  } else {
    throw new Error(
      `Invalid contents given. Gemini Does not support mixing parts and contents: ${JSON.stringify(
        inputs
      )}`
    );
  }
  return convertedContents;
}
