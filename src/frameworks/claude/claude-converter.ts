import {
  EvaluationProxyAPIRequest,
  LLMMessage,
  LLMToolCall,
  LLMToolDefinition,
} from '../../types';
import { CanonicalEvaluationStrategy } from '../canonical';
import { type MessageCreateParams, type MessageStreamParams} from '@anthropic-ai/sdk/resources';
import { Message } from '@anthropic-ai/sdk/resources';
import { RawMessageStreamEvent, MessageStreamEvent } from '@anthropic-ai/sdk/resources/messages';

type AnthropicCreateAPIResponsesType = Message | RawMessageStreamEvent;

type AnthropicAPIRequestsType = MessageCreateParams
type AnthropicAPIResponsesType =
  | AnthropicCreateAPIResponsesType
  | MessageStreamParams;

export class ClaudeCanonicalEvaluationStrategy
  implements
    CanonicalEvaluationStrategy<
      AnthropicAPIRequestsType,
      AnthropicAPIResponsesType
    > {
  async convertToQualifireEvaluationRequest(
    request: AnthropicAPIRequestsType,
    response: AnthropicAPIResponsesType
  ): Promise<EvaluationProxyAPIRequest> {
    const {
      messages: requestMessages,
      available_tools: requestAvailableTools,
    } = this.convertRequest(request);

    const messages: LLMMessage[] = requestMessages || [];
    const available_tools: LLMToolDefinition[] = requestAvailableTools || [];

    // Check if response is streaming or non-streaming
    if (Array.isArray(response)) {
      const streamingResultMessages = await this.handleStreaming(response as Array<MessageStreamEvent>);
      messages.push(...streamingResultMessages);
    } else {
      const nonStreamingResultMessages = await this.handleNonStreamingResponse(
        response
      );
      messages.push(...nonStreamingResultMessages);
    }

    return {
      messages,
      available_tools: available_tools,
    };
  }

  convertRequest(request: any): EvaluationProxyAPIRequest {
    const messages: LLMMessage[] = [];
    const availableTools: LLMToolDefinition[] = [];

    // Handle Claude system message first (if present)
    if (request?.system) {
      messages.push({
        role: 'system',
        content: request.system,
      });
    }

    // Handle Claude request messages
    if (request?.messages) {
      messages.push(
        ...this.convertResponseMessagesToLLMMessages(request.messages)
      );
    }

    // Handle tools
    if (request?.tools) {
      for (const tool of request.tools) {
        availableTools.push({
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema?.properties || {},
        });
      }
    }

    return {
      messages,
      available_tools: availableTools,
    };
  }

  private async handleStreaming(response: Array<MessageStreamEvent>): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    let accumulatedContent = [];
    for (const chunk of response) {
      // Handle streaming chunk with message_start type
      const content = extractContentFromRawMessageStreamEvent(chunk);
      if (content) {
        accumulatedContent.push(content);
      }
    }

    messages.push({
      role: 'assistant',
      content: accumulatedContent.join('').trim(),
    });

    return messages;
  }

  private async handleNonStreamingResponse(
    response: any
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    if (response?.role) {
      messages.push(...this.convertResponseMessagesToLLMMessages([response]));
    }

    return messages;
  }

  // Claude-specific function to convert Response API messages to LLM messages
  private convertResponseMessagesToLLMMessages(messages: any[]): LLMMessage[] {
    const extracted_messages: LLMMessage[] = [];

    for (const message of messages) {
      if (typeof message.content === 'string') {
        const llmMessage: LLMMessage = {
          role: message.role,
          content: message.content,
        };
        extracted_messages.push(llmMessage);
        continue;
      }
      const content: string[] = [];
      const tool_calls: LLMToolCall[] = [];
      const role: string = message.role;
      let messageContents = [];
      if (message.content) {
        messageContents = message.content;
      } else if (message.parts) {
        messageContents = message.parts;
      } else {
        continue;
      }
      for (const part of messageContents) {
        // claude has messages with only one content. In that case we can add a message based on that single content.
        if (messageContents.length == 1) {
          switch (part.type) {
            case 'tool_use':
              extracted_messages.push({
                role: 'assistant' as const,
                tool_calls: [
                  {
                    name: part.name,
                    arguments: part.input,
                    id: part.id,
                  },
                ],
              });
              break;
            case 'tool_result':
              extracted_messages.push({
                role: 'tool' as const,
                content: JSON.stringify(part.content),
              });
              break;
            case 'text':
              const textMessage: LLMMessage = {
                role: role,
                content: part.text,
              };
              extracted_messages.push(textMessage);
              break;
            default:
              throw new Error(
                'Invalid Claude output: message - ' +
                  JSON.stringify(message) +
                  ' part - ' +
                  JSON.stringify(part)
              );
          }
        }
      }

      // If we accumulated content or tool_calls, add the message
      if (content.length > 0 || tool_calls.length > 0) {
        const accumulatedMessage: LLMMessage = {
          role,
        };

        if (content.length > 0) {
          accumulatedMessage.content = content.join(' ');
        }

        // Only add tool_calls property for assistant messages
        if (tool_calls.length > 0) {
          accumulatedMessage.tool_calls = tool_calls;
        }
        extracted_messages.push(accumulatedMessage);
      }
    }
    return extracted_messages;
  }
}

function extractContentFromRawMessageStreamEvent(event: RawMessageStreamEvent): string {
  switch (event.type) {
    case 'content_block_start':
      if (event.content_block.type === 'text') {
        return event.content_block.text;
      }
      return '';
    case 'content_block_delta':
      if (event.delta.type === 'text_delta') {
        return event.delta.text;
      }
      return '';
    default:
      return '';
  }
}