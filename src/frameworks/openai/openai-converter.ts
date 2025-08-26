import {
  EvaluationProxyAPIRequest,
  LLMMessage,
  LLMToolCall,
  LLMToolDefinition,
} from '../../types';
import {
  CanonicalEvaluationStrategy,
  convertResponseMessagesToLLMMessages,
  convertToolsToLLMDefinitions,
} from '../canonical';

import type { GenerateTextResult, StreamTextResult, ToolSet } from 'ai';
import {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionCreateParamsBase,
} from 'openai/resources/chat/completions/completions';
import { Completion } from 'openai/resources/completions';
import { ResponseCreateParamsBase } from 'openai/resources/responses/responses';

type OpenAICanonicalEvaluationStrategyResponse = any;
type OpenAICanonicalEvaluationStrategyRequest = any;

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

  async convertRequest(
    request: OpenAICanonicalEvaluationStrategyRequest
  ): Promise<EvaluationProxyAPIRequest> {
    // Determine which API is being used and call the appropriate method
    if (request?.messages) {
      return this.convertRequestForChatCompletions(request);
    } else if (request?.instructions || request?.input) {
      return this.convertRequestForResponse(request);
    } else {
      throw new Error('Invalid request: ' + JSON.stringify(request));
    }
  }

  async convertRequestForChatCompletions(
    request: OpenAICanonicalEvaluationStrategyRequest
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

  async convertRequestForResponse(
    request: OpenAICanonicalEvaluationStrategyRequest
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
        messages.push(...convertResponseMessagesToLLMMessages(request.input));
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
    responseChunks: OpenAICanonicalEvaluationStrategyResponse
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    if (responseChunks.length === 0) {
      return messages;
    }

    // Determine API type from the first chunk
    const firstChunk = responseChunks[0];
    if (firstChunk?.choices) {
      return this.handleChatCompletionsStreaming(responseChunks);
    } else {
      return this.handleResponseApiStreaming(responseChunks);
    }
  }

  private async handleChatCompletionsStreaming(
    responseChunks: any[]
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    // Initialize accumulator for content and tools from the first choice delta
    let accumulatedContent = '';
    const accumulatedToolCalls: any[] = [];
    let messageRole: string | undefined;

    for (const chunk of responseChunks) {
      const result = this.processChatCompletionsChunk(
        chunk,
        messages,
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
    responseChunks: any[]
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    // Initialize accumulator for Response API streaming content
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
    chunk: any,
    messages: LLMMessage[],
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

      // Handle non-delta format
      else if (firstChoice.message?.role) {
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
        }
      }
    }

    return { accumulatedContent, messageRole };
  }

  private processResponseApiChunk(
    chunk: any,
    messages: LLMMessage[]
  ): {
    accumulatedContent: string;
    messageRole?: string;
  } | null {
    // Handle legacy format - direct output
    if (chunk.output) {
      messages.push(...convertResponseMessagesToLLMMessages(chunk.output));
      return null;
    }

    // Handle streaming response completion
    if (
      chunk.sequence_number &&
      chunk.type == 'response.completed' &&
      chunk.response?.output
    ) {
      messages.push(
        ...convertResponseMessagesToLLMMessages(chunk.response.output)
      );
      return null;
    }

    // Handle new streaming format - text deltas
    if (chunk.type === 'response.output_text.delta' && chunk.delta) {
      return {
        accumulatedContent: chunk.delta,
        messageRole: 'assistant', // Response API messages are always from assistant
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
    response: OpenAICanonicalEvaluationStrategyResponse
  ): Promise<LLMMessage[]> {
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
    response: OpenAICanonicalEvaluationStrategyResponse
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    if (response.output) {
      messages.push(...convertResponseMessagesToLLMMessages(response.output));
    } else {
      throw new Error(
        'Invalid response API response: ' + JSON.stringify(response)
      );
    }

    return messages;
  }
}
