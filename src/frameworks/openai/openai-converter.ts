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
  type ChatCompletionMessageParam,
  type ChatCompletionDeveloperMessageParam,
  type ChatCompletionContentPartText,
  type ChatCompletionAssistantMessageParam,
  type ChatCompletionToolMessageParam,
  type ChatCompletionContentPartRefusal,
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
        const responsesApiMessages = await this.handleResponsesApiNonStreaming(
          response
        );
        messages.push(...responsesApiMessages);
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
      return this.convertRequestForResponsesAPI(request);
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
      messages.push(
        ...this.convertRequestMessagesForChatCompletions(request.messages as ChatCompletionMessageParam[])
      );
    }

    if (request?.tools) {
      available_tools = convertToolsToLLMDefinitions(request?.tools);
    }

    return {
      messages,
      available_tools,
    };
  }

  private convertRequestMessagesForChatCompletions(
    messages: ChatCompletionMessageParam[]
  ): LLMMessage[] {
    const convertedMessages: LLMMessage[] = [];

    for (const message of messages) {
      let content: string | undefined;
      let tool_calls: LLMToolCall[] | undefined;
      
      switch (message.role) {
        case 'system':
        case 'developer':
        case 'user':
          let textMessage = message as ChatCompletionDeveloperMessageParam // This works the same for System user and developer. Used this type just out of comfort
          if (typeof textMessage.content === 'string') {
            content = textMessage.content as string;
          } else {
            content = (textMessage.content as ChatCompletionContentPartText[]).filter((part) => part.type === 'text').map((part) => part.text).join('')
          }
          break;
        case 'assistant':
          let assistantMessage = message as ChatCompletionAssistantMessageParam
          if (assistantMessage.content) {
            if (typeof assistantMessage.content === 'string') {
              content = assistantMessage.content;
            } else {
              content = (assistantMessage.content as Array<ChatCompletionContentPartText | ChatCompletionContentPartRefusal>).filter((part) => part.type === 'text').map((part) => (part as ChatCompletionContentPartText).text).join('')
            }
          }
          if (assistantMessage.tool_calls) {
            tool_calls = assistantMessage.tool_calls
            .filter((tool_call) => tool_call.type === "function")
            .map((tool_call) => {
                  // It's of type ChatCompletionMessageFunctionToolCall but it's not exported
                  let toolArguments = {}
                  try {
                    toolArguments = JSON.parse(tool_call.function?.arguments)
                  } catch (error) {
                    console.debug('Error parsing tool call arguments. Using empty object instead:', error)
                    toolArguments = {}
                  }
                  return {
                    name: tool_call.function?.name || '',
                    arguments: toolArguments,
                    id: tool_call.id,
                  }
            }) as LLMToolCall[]
          }
          break;
        case 'tool':
          let toolMessage = message as ChatCompletionToolMessageParam
          if (toolMessage.content) {
            if (typeof toolMessage.content === 'string') {
              content = toolMessage.content;
            } else {
              content = (toolMessage.content as Array<ChatCompletionContentPartText>).filter((part) => part.type === 'text').map((part) => part.text).join('')
            }
          }
          break;

        default:
          throw new Error('Invalid request: ' + JSON.stringify(message));
      }
      if (content || tool_calls) {
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

  async convertRequestForResponsesAPI(
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
    responseChunks: Array<any>
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
      return this.handleResponsesApiStreaming(responseChunks);
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

      // Overwriting the accumulated content (Accumulation is done inside the processChatCompletionsChunk)
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

  private async handleResponsesApiStreaming(
    responseChunks: Array<ResponseStreamEvent>
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    // Initialize accumulator for Responses API streaming content
    let accumulatedContent = '';
    let accumulatedArguments = '';
    let toolName = '';
    let toolId = '';
    let messageRole: string | undefined;

    for (const chunk of responseChunks) {
      const messageResult = this.processResponsesApiChunkMessage(chunk);
      if (messageResult) {
        if (messageResult.accumulatedContent) {
        accumulatedContent += messageResult.accumulatedContent;
        }
        if (messageResult.messageRole) {  
          messageRole = messageResult.messageRole;
        }
      } else {
        const toolCallResult = this.processResponsesApiChunkToolCall(chunk);
        if (toolCallResult) {
          if (toolCallResult.argumentsDelta) {
            accumulatedArguments += toolCallResult.argumentsDelta;
          }
          if (toolCallResult.toolName) {
            toolName = toolCallResult.toolName;
          }
          if (toolCallResult.toolCallId) {
            toolId = toolCallResult.toolCallId;
          }
        }
      }
    }

    // After processing all chunks, create the final accumulated message
    // Handle tool call case - tool calls are always from assistant role
    if (toolName && toolId) {
      let parsedArguments = {};
      try {
        parsedArguments = accumulatedArguments ? JSON.parse(accumulatedArguments) : {};
      } catch (error) {
        console.debug('Error parsing accumulated tool call arguments. Using empty object instead:', error);
        parsedArguments = {};
      }

      const toolCallMessage: LLMMessage = {
        role: 'assistant',
        tool_calls: [{
          name: toolName,
          arguments: parsedArguments,
          id: toolId,
        }],
      };
      messages.push(toolCallMessage);
    }
    // Handle regular message case - only if we have content and no tool call
    else if (messageRole && accumulatedContent) {
      const contentMessage: LLMMessage = {
        role: messageRole,
        content: accumulatedContent,
      };
      messages.push(contentMessage);
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
            if (
              toolCall.function?.arguments &&
              typeof toolCall.function.arguments === 'string'
            ) {
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

  private processResponsesApiChunkMessage(
    chunk: any,
  ): {
    accumulatedContent?: string;
    messageRole?: string;
  } | null{
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
        messageRole: chunk.item.role,
      };
    }

    return null;
  }

  private processResponsesApiChunkToolCall(
    chunk: any
  ): { argumentsDelta?: string; toolName?: string; toolCallId?: string } | null {
    // Handle OpenAI Responses API function call arguments streaming
    if (chunk.type === 'response.function_call_arguments.delta' && chunk.delta) {
      // Return the arguments delta for concatenation
      return {
        argumentsDelta: chunk.delta,
      };
    }

    // Handle function call item added (establishes the function call)
    if (chunk.type === 'response.output_item.added' && chunk.item?.type === 'function_call') {
      const item = chunk.item;
      
      return {
        toolName: item.name,
        toolCallId: item.call_id,
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

  private async handleResponsesApiNonStreaming(
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
    if (message.type === 'function_call_output') {
      extracted_messages.push({
        role: 'tool',
        content: message.output,
      });
    continue;
    }
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
