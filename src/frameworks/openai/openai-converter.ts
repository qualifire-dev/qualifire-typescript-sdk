import {
  EvaluationProxyAPIRequest,
  LLMMessage,
  LLMToolCall,
  LLMToolDefinition,
} from '../../types';
import { CanonicalEvaluationStrategy } from '../canonical';

import {
  ChatCompletion,
  ChatCompletionChunk,
} from 'openai/resources/chat/completions';
import {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionCreateParamsBase,
} from 'openai/resources/chat/completions/completions';
import {
  Response,
  ResponseCreateParamsNonStreaming,
  ResponseCreateParamsStreaming,
  ResponseCreateParamsBase,
  ResponseStreamEvent,
} from 'openai/resources/responses/responses';

type OpenAIResponseCreateRequest =
  | ResponseCreateParamsNonStreaming
  | ResponseCreateParamsStreaming
  | ResponseCreateParamsBase;

type OpenAIResponseCreateRequestResponse =
  | Response
  | Array<ResponseStreamEvent>;

type OpenAIChatCompletionsCreateRequest =
  | ChatCompletionCreateParamsNonStreaming
  | ChatCompletionCreateParamsStreaming
  | ChatCompletionCreateParamsBase;

type OpenAIChatCompletionsCreateResponse =
  | ChatCompletion
  | Array<ChatCompletionChunk>;

type OpenAICanonicalEvaluationStrategyRequest =
  | OpenAIResponseCreateRequest
  | OpenAIChatCompletionsCreateRequest;

type OpenAICanonicalEvaluationStrategyResponse =
  | OpenAIResponseCreateRequestResponse
  | OpenAIChatCompletionsCreateResponse;

export class OpenAICanonicalEvaluationStrategy
  implements
    CanonicalEvaluationStrategy<
      OpenAICanonicalEvaluationStrategyRequest,
      OpenAICanonicalEvaluationStrategyResponse
    > {
  async convertToQualifireEvaluationRequest(
    request: OpenAICanonicalEvaluationStrategyRequest,
    response: OpenAICanonicalEvaluationStrategyResponse
  ): Promise<EvaluationProxyAPIRequest> {
    request = request as OpenAIChatCompletionsCreateRequest;
    response = response as OpenAIChatCompletionsCreateResponse;

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
      // Determine which API is being used and call the appropriate method
      if (response?.choices) {
        const chatCompletionsMessages = await this.handleChatCompletionsNonStreaming(
          response
        );
        messages.push(...chatCompletionsMessages);
      } else {
        response = (response as unknown) as Response;
        const responseApiMessages = await this.handleResponseApiNonStreaming(
          response
        );
        messages.push(...responseApiMessages);
      }
    }

    return {
      messages,
      available_tools,
    };
  }

  async convertRequest(request: any): Promise<EvaluationProxyAPIRequest> {
    // Determine which API is being used and call the appropriate method
    if (request.messages) {
      return this.convertRequestForChatCompletions(request);
    } else if (request?.instructions || request?.input) {
      return this.convertRequestForResponseAPI(request);
    } else {
      throw new Error('Invalid request: ' + JSON.stringify(request));
    }
  }

  async convertRequestForChatCompletions(
    request: OpenAIChatCompletionsCreateRequest
  ): Promise<EvaluationProxyAPIRequest> {
    const messages: LLMMessage[] = [];
    let available_tools: LLMToolDefinition[] = [];

    if (request?.messages) {
      messages.push(...this.convertRequestMessages(request.messages));
    }

    if (request?.tools) {
      available_tools = convertToolsToLLMDefinitions(request?.tools);
    }

    return {
      messages,
      available_tools,
    };
  }

  private convertRequestMessages(messages: any[]): LLMMessage[] {
    const convertedMessages: LLMMessage[] = [];

    for (const message of messages) {
      let content: string | undefined;
      let tool_calls: LLMToolCall[] | undefined;
      if (message.role) {
        if (message.content) {
          content = message.content;
        }
        if (message.tool_calls && message.tool_calls.length > 0) {
          tool_calls = [];
          for (const tool_call of message.tool_calls) {
            let tool_call_arguments: Record<string, any> = {};
            if (tool_call.arguments) {
              tool_call_arguments = JSON.parse(tool_call.arguments);
            }
            tool_calls.push({
              name: tool_call.name,
              id: tool_call.id,
              arguments: tool_call_arguments,
            });
          }
        }
        convertedMessages.push({
          role: message.role,
          content: content,
          tool_calls: tool_calls,
        });
      } else {
        throw new Error('Invalid request: ' + JSON.stringify(message));
      }
    }

    return convertedMessages;
  }

  async convertRequestForResponseAPI(
    request: OpenAIResponseCreateRequest
  ): Promise<EvaluationProxyAPIRequest> {
    const messages: LLMMessage[] = [];
    let available_tools: LLMToolDefinition[] = [];

    if (request?.instructions) {
      messages.push({
        role: 'system',
        content: request.instructions,
      });
    }

    if (request?.input) {
      if (typeof request.input === 'string') {
        messages.push({
          role: 'user',
          content: request.input,
        });
      } else {
        messages.push(
          ...convertResponsesAPIMessagesToLLMMessages(request.input)
        );
      }
    }

    if (request?.tools) {
      available_tools = convertToolsToLLMDefinitions(request?.tools);
    }

    return {
      messages,
      available_tools,
    };
  }

  private async handleStreaming(
    responseChunks: Array<any> | Array<any>
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    if (responseChunks.length === 0) {
      return messages;
    }

    // Determine API type from the first chunk
    const firstChunk = responseChunks[0];
    if (firstChunk.choices) {
      return this.handleChatCompletionsStreaming(responseChunks);
    } else {
      return this.handleResponseApiStreaming(responseChunks);
    }
  }

  private async handleChatCompletionsStreaming(
    responseChunks: Array<ChatCompletionChunk>
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    // Initialize accumulator for content and tools from the first choice delta
    let accumulatedContent = '';
    const accumulatedToolCalls: any[] = [];
    let messageRole: string | undefined;

    for (const chunk of responseChunks) {
      const result = this.processChatCompletionsChunk(
        chunk,
        accumulatedContent,
        accumulatedToolCalls,
        messageRole
      );
      accumulatedContent = result.accumulatedContent;
      messageRole = result.messageRole;
    }

    // After processing all chunks, create the final accumulated message if we have content
    if (
      messageRole &&
      (accumulatedContent || accumulatedToolCalls.length > 0)
    ) {
      const finalMessage: LLMMessage = {
        role: messageRole,
      };

      if (accumulatedContent) {
        finalMessage.content = accumulatedContent;
      }

      if (accumulatedToolCalls.length > 0) {
        finalMessage.tool_calls = accumulatedToolCalls.map(
          (tool_call: any) => ({
            name: tool_call.function.name,
            arguments: tool_call.function.arguments
              ? JSON.parse(tool_call.function.arguments)
              : {},
            id: tool_call.id,
          })
        );
      }

      messages.push(finalMessage);
    }

    return messages;
  }

  private async handleResponseApiStreaming(
    responseChunks: Array<ResponseStreamEvent>
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    // Initialize accumulator for Responses API streaming content
    let accumulatedContent = '';
    let messageRole: string | undefined;

    for (const chunk of responseChunks) {
      const result = this.processResponseApiChunk(chunk, messages);
      if (result) {
        accumulatedContent += result.accumulatedContent;
        if (result.messageRole) {
          messageRole = result.messageRole;
        }
      }
    }

    // After processing all chunks, create the final accumulated message if we have content
    if (messageRole && accumulatedContent) {
      const finalMessage: LLMMessage = {
        role: messageRole,
        content: accumulatedContent,
      };
      messages.push(finalMessage);
    }

    return messages;
  }

  private processChatCompletionsChunk(
    chunk: ChatCompletionChunk,
    accumulatedContent: string,
    accumulatedToolCalls: any[],
    messageRole: string | undefined
  ): { accumulatedContent: string; messageRole: string | undefined } {
    // chat completions api - handle streaming with delta objects
    if (chunk?.choices && chunk.choices.length > 0) {
      const firstChoice = chunk.choices[0];

      if (firstChoice.delta) {
        // Accumulate role if present
        if (firstChoice.delta.role) {
          messageRole = firstChoice.delta.role;
        }

        // Accumulate content if present
        if (firstChoice.delta.content) {
          accumulatedContent += firstChoice.delta.content;
        }

        // Accumulate tool calls if present
        if (firstChoice.delta.tool_calls) {
          for (const toolCall of firstChoice.delta.tool_calls) {
            // Initialize tool call accumulator if this is a new tool call
            if (!accumulatedToolCalls[toolCall.index]) {
              accumulatedToolCalls[toolCall.index] = {
                id: toolCall.id || '',
                type: toolCall.type || 'function',
                function: {
                  name: toolCall.function?.name || '',
                  arguments: '',
                },
              };
            }

            // Accumulate function name and arguments
            if (toolCall.function?.name) {
              accumulatedToolCalls[toolCall.index].function.name =
                toolCall.function.name;
            }
            if (toolCall.function?.arguments) {
              accumulatedToolCalls[toolCall.index].function.arguments +=
                toolCall.function.arguments;
            }
            if (toolCall.id) {
              accumulatedToolCalls[toolCall.index].id = toolCall.id;
            }
          }
        }
      }
    }

    return { accumulatedContent, messageRole };
  }

  private processResponseApiChunk(
    // chunk: ResponseStreamEvent,
    chunk: any,
    messages: LLMMessage[]
  ): {
    accumulatedContent: string;
    messageRole?: string;
  } | null {
    // Handle legacy format - direct output
    if (chunk.output) {
      messages.push(...convertResponsesAPIMessagesToLLMMessages(chunk.output));
      return null;
    }

    // Handle streaming response completion
    if (
      chunk.sequence_number &&
      chunk.type === 'response.completed' &&
      chunk.response?.output
    ) {
      messages.push(
        ...convertResponsesAPIMessagesToLLMMessages(chunk.response.output)
      );
      return null;
    }

    // Handle new streaming format - text deltas
    if (chunk.type === 'response.output_text.delta' && chunk.delta) {
      return {
        accumulatedContent: chunk.delta,
        messageRole: 'assistant', // Responses API messages are always from assistant
      };
    }

    // Handle new streaming format - completed response (fallback for final message)
    if (chunk.type === 'response.completed' && chunk.response?.output) {
      // This handles the case where we have a complete response at the end
      // but we'll mainly rely on the accumulated deltas above
      return null;
    }

    // Handle output item added (establishes the message role)
    if (chunk.type === 'response.output_item.added' && chunk.item?.role) {
      return {
        accumulatedContent: '',
        messageRole: chunk.item.role,
      };
    }

    return null;
  }

  private async handleChatCompletionsNonStreaming(
    response: ChatCompletion
  ): Promise<LLMMessage[]> {
    response = response as ChatCompletion;

    const messages: LLMMessage[] = [];

    if (!response?.choices) {
      throw new Error('Invalid chat completions response: missing choices');
    }

    const firstChoice = response.choices[0];
    if (firstChoice.message?.role) {
      const message: LLMMessage = {
        role: firstChoice.message.role,
      };
      if (firstChoice.message?.content) {
        message.content = firstChoice.message.content;
      }
      if (firstChoice.message?.tool_calls) {
        message.tool_calls = firstChoice.message.tool_calls.map(
          (tool_call: any) => ({
            name: tool_call.function.name,
            arguments: tool_call.function.arguments
              ? JSON.parse(tool_call.function.arguments)
              : {},
            id: tool_call.id,
          })
        );
      }
      if (message.content || message.tool_calls) {
        messages.push(message);
      } else {
        throw new Error('Invalid response: ' + JSON.stringify(firstChoice));
      }
    }

    return messages;
  }

  private async handleResponseApiNonStreaming(
    response: Response
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    if (response.output) {
      messages.push(
        ...convertResponsesAPIMessagesToLLMMessages(response.output)
      );
    } else {
      throw new Error(
        'Invalid Responses API response: ' + JSON.stringify(response)
      );
    }

    return messages;
  }
}

// OpenAI-specific function to convert Responses API messages to LLM messages
function convertResponsesAPIMessagesToLLMMessages(
  messages: any[]
): LLMMessage[] {
  const extracted_messages: LLMMessage[] = [];

  for (const message of messages) {
    // Handle OpenAI Responses API function_call type
    if (message.type === 'function_call') {
      extracted_messages.push({
        role: 'assistant' as const,
        tool_calls: [
          {
            name: message.name,
            arguments: JSON.parse(message.arguments),
            id: message.call_id,
          },
        ],
      });
      continue;
    }

    // Handle simple string content messages
    if (typeof message.content === 'string') {
      extracted_messages.push({
        role: message.role,
        content: message.content,
      });
      continue;
    }

    const content: string[] = [];
    let role: string = message.role;
    let messageContents = [];

    if (message.content) {
      messageContents = message.content;
    } else if (message.parts) {
      messageContents = message.parts;
    } else {
      continue;
    }

    for (const contentElement of messageContents) {
      // Handle OpenAI Responses API specific content types
      switch (contentElement.type) {
        case 'function_call_output':
        case 'output_text':
          role = 'assistant' as const;
          content.push(contentElement.text);
          break;
        case 'text':
        case 'input_text':
          content.push(contentElement.text);
          break;
        default:
          // Handle message-level types for OpenAI Responses API
          switch (message.type) {
            case 'message':
              // Already handled above in the contentElement switch
              break;
            case 'web_search_call':
              extracted_messages.push({
                role: 'assistant' as const,
                tool_calls: [
                  {
                    name: message.name,
                    arguments: {},
                    id: message.id,
                  },
                ],
              });
              break;
            case 'file_search_call':
              const toolArguments = message.queries
                ? { queries: message?.queries }
                : {};
              extracted_messages.push({
                role: 'assistant' as const,
                tool_calls: [
                  {
                    name: message.name,
                    arguments: toolArguments,
                    id: message.id,
                  },
                ],
              });
              break;
            case 'function_call':
              extracted_messages.push({
                role: 'assistant' as const,
                tool_calls: [
                  {
                    name: message.name,
                    arguments: JSON.parse(message.arguments),
                    id: message.id,
                  },
                ],
              });
              break;
            default:
              throw new Error(
                'Invalid OpenAI Responses API output: message - ' +
                  JSON.stringify(message) +
                  ' contentElement - ' +
                  JSON.stringify(contentElement)
              );
          }
      }
    }

    // Add accumulated content message if we have content
    if (content.length > 0) {
      extracted_messages.push({
        role,
        content: content.join(' '),
      });
    }
  }

  return extracted_messages;
}
export function convertToolsToLLMDefinitions(
  tools: unknown[]
): LLMToolDefinition[] {
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
        name: functionDef.name,
        description: functionDef.description,
        parameters: functionDef.parameters,
      };

      results.push(llmTool);
    } else if (toolObj.name && typeof toolObj.name === 'string') {
      const llmTool: LLMToolDefinition = {
        name: toolObj.name,
        description: toolObj.description,
        parameters:
          toolObj.parameters?.properties ||
          toolObj.parameters ||
          toolObj.args ||
          {},
      };

      results.push(llmTool);
    }
  }

  return results;
}
