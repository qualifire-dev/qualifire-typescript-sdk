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
    request: OpenAICanonicalEvaluationStrategyRequest
  ): Promise<EvaluationProxyAPIRequest> {
    // Determine which API is being used and call the appropriate method
    if (request?.messages) {
      return this.convertRequestForChatCompletions(request);
    } else if (request?.instructions || request?.input) {
      return this.convertRequestForResponse(request);
    } else {
      // Fallback to original logic if neither pattern matches
      const messages: LLMMessage[] = [];
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

  async convertRequestForChatCompletions(
    request: OpenAICanonicalEvaluationStrategyRequest
  ): Promise<EvaluationProxyAPIRequest> {
    const messages: LLMMessage[] = [];
    let available_tools: LLMToolDefinition[] = [];

    // chat completions api
    if (request?.messages) {
      for (const message of request.messages) {
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
          messages.push({
            role: message.role,
            content: content,
            tool_calls: tool_calls,
          });
        } else {
          throw new Error('Invalid request: ' + JSON.stringify(message));
        }
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

  async convertRequestForResponse(
    request: OpenAICanonicalEvaluationStrategyRequest
  ): Promise<EvaluationProxyAPIRequest> {
    const messages: LLMMessage[] = [];
    let available_tools: LLMToolDefinition[] = [];

    // response api
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
    response: OpenAICanonicalEvaluationStrategyResponse
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    // Initialize accumulator for content and tools from the first choice delta
    let accumulatedContent = '';
    let accumulatedToolCalls: any[] = [];
    let messageRole: string | undefined;

    for (const chunk of response) {
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

        // Handle non-streaming format (fallback for compatibility)
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

      //response api
      if (chunk.output) {
        messages.push(...convertResponseMessagesToLLMMessages(chunk.output));
      } else if (chunk.sequence_number && chunk.type == 'response.completed') {
        // For streaming responses
        if (chunk.response?.output) {
          messages.push(
            ...convertResponseMessagesToLLMMessages(chunk.response.output)
          );
        } else {
          throw new Error('Invalid response: ' + JSON.stringify(chunk));
        }
      }
    }

    // After processing all chunks, create the final accumulated message
    if (messageRole) {
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

      if (finalMessage.content || finalMessage.tool_calls) {
        messages.push(finalMessage);
      }
    }

    return messages;
  }

  private async handleNonStreamingResponse(
    response: OpenAICanonicalEvaluationStrategyResponse
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    // chat completions api
    if (response?.choices) {
      for (const choice of response.choices) {
        if (choice.message?.role) {
          const message: LLMMessage = {
            role: choice.message.role,
          };
          if (choice.message?.content) {
            message.content = choice.message.content;
          }
          if (choice.message?.tool_calls) {
            message.tool_calls = choice.message.tool_calls.map(
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
            throw new Error('Invalid response: ' + JSON.stringify(choice));
          }
        }
      }
    }

    //response api
    if (response.output) {
      messages.push(...convertResponseMessagesToLLMMessages(response.output));
    } else if (
      response.sequence_number &&
      response.type == 'response.completed'
    ) {
      // For streaming responses
      if (response.response?.output) {
        messages.push(
          ...convertResponseMessagesToLLMMessages(response.response.output)
        );
      } else {
        throw new Error('Invalid response: ' + JSON.stringify(response));
      }
    }

    return messages;
  }
}
