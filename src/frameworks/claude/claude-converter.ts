import {
  EvaluationProxyAPIRequest,
  LLMMessage,
  LLMToolCall,
  LLMToolDefinition,
} from '../../types';
import { CanonicalEvaluationStrategy } from '../canonical';
import { type MessageCreateParams, type MessageStreamParams} from '@anthropic-ai/sdk/resources';
import { Message } from '@anthropic-ai/sdk/resources';
import { RawMessageStreamEvent, MessageStreamEvent,
  type TextBlock,
  type RawMessageStartEvent,
  type RawContentBlockStartEvent,
  type RawContentBlockDeltaEvent,
  type RawContentBlockStopEvent,
  type ContentBlock,
  type ThinkingBlock,
  type ToolUseBlock,
  type ContentBlockParam,
  type ToolResultBlockParam,
  type TextBlockParam,
  type TextDelta,
  type InputJSONDelta,
} from '@anthropic-ai/sdk/resources/messages';

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
        content: request.system as string,
      });
    }

    // Handle Claude request messages
    if (request?.messages) {
      messages.push(
        ...this.convertClaudeMessagesToLLMMessages(request.messages as Array<Message>)
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

    let role: string | undefined;
    let accumulatedContent: string[] = [];
    let accumulatedToolName: string | undefined;
    let accumulatedToolId: string | undefined;
    let accumulatedToolInput: string[] = [];
    for (const responseEvent of response) {
      switch (responseEvent.type) {
        case 'message_start':
          const rawMessageStartEvent = responseEvent as RawMessageStartEvent;
          role = rawMessageStartEvent.message.role;
          accumulatedContent = [];
          accumulatedToolName = undefined;
          accumulatedToolId = undefined;
          accumulatedToolInput = [];
          break;
        case 'content_block_start':
          const rawContentBlockStartEvent = responseEvent as RawContentBlockStartEvent;
          switch (rawContentBlockStartEvent.content_block.type) {
            case 'text':
              const textBlock = rawContentBlockStartEvent.content_block as TextBlock;  
              accumulatedContent.push(textBlock.text)
              break;
            case 'tool_use':
              const toolUseBlock = rawContentBlockStartEvent.content_block as ToolUseBlock;
              accumulatedToolId = toolUseBlock.id
              accumulatedToolName = toolUseBlock.name
              accumulatedToolInput = []
              break;
            case 'thinking':
              const thinkingBlock = rawContentBlockStartEvent.content_block as ThinkingBlock;
              accumulatedContent.push(thinkingBlock.thinking)
              break;
            default:
              console.debug(`Invalid content block type: ${responseEvent}`);
          }
          break;
        case 'content_block_delta':
          const rawContentBlockDeltaEvent = responseEvent as RawContentBlockDeltaEvent;
          switch (rawContentBlockDeltaEvent.delta.type) {
              case 'text_delta':
                const textDelta = rawContentBlockDeltaEvent.delta as TextDelta;
                accumulatedContent.push(textDelta.text)
                break;
              case 'input_json_delta':
                const inputJsonDelta = rawContentBlockDeltaEvent.delta as InputJSONDelta;
                accumulatedToolInput.push(inputJsonDelta.partial_json)
                break;
              default:
                console.debug(`Invalid delta type: ${rawContentBlockDeltaEvent}`);
          }
          break;
        case 'message_stop':
          let finalContent: string | undefined;
          if (accumulatedContent.length > 0) {
            finalContent = accumulatedContent.join('').trim();
          }
          let finalTool: LLMToolCall | undefined;
          if (accumulatedToolName) {
            finalTool = {
              id: accumulatedToolId,
              name: accumulatedToolName,
              arguments: JSON.parse(accumulatedToolInput.join('')),
            };
          };
          if (!role) {
            console.debug(`role was not set`);
            continue;
          }
          messages.push({
            role: role == 'model' ? 'assistant' : role,
            content: finalContent ?? undefined,
            tool_calls: finalTool ? [finalTool] : undefined,
          });
          role = undefined;
          accumulatedContent = [];
          accumulatedToolName = undefined;
          accumulatedToolId = undefined;
          accumulatedToolInput = [];
          break;
        case 'content_block_stop':
        case 'message_delta':
          break;
        default:
          console.debug(`Invalid event: ${responseEvent}`);
      }
    }
    return messages;
  }

  private async handleNonStreamingResponse(
    response: any
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    if (response?.role) {
      messages.push(...this.convertClaudeMessagesToLLMMessages([response] as Array<Message>));
    }

    return messages;
  }

  // Claude-specific function to convert Response API messages to LLM messages
  private convertClaudeMessagesToLLMMessages(messages: Array<Message>): LLMMessage[] {
    const extractedMessages: LLMMessage[] = [];

    for (const message of messages) {
      if (typeof message.content === 'string') {
        const llmMessage: LLMMessage = {
          role: message.role,
          content: message.content,
        };
        extractedMessages.push(llmMessage);
        continue;
      }
      const aggregatedContent: string[] = [];
      const aggregatedToolCalls: LLMToolCall[] = [];
      const role: string = message.role;
      if (!message.content) {
        continue;
      }
      for (const part of (message.content as Array<ContentBlockParam>)) {
        switch (part.type) {
          case 'tool_use':
            const toolUseBlock = part as ToolUseBlock;
            aggregatedToolCalls.push({
                name: toolUseBlock.name,
                arguments: toolUseBlock.input as Record<string, any>,
                id: toolUseBlock.id,
            });
            break;
          case 'tool_result':
            const toolResultBlock = part as ToolResultBlockParam;
            if (typeof toolResultBlock.content === 'string') {
              aggregatedContent.push(toolResultBlock.content)
            } else {
              (toolResultBlock.content as Array<ContentBlockParam>).filter(part => part.type === 'text').forEach(part => {   
                const textPart = part as TextBlockParam;
                aggregatedContent.push(textPart.text)
              })
            }
            break;
          case 'text':
            const textBlock = part as TextBlock;
            aggregatedContent.push(textBlock.text)
            break;
          default:
            console.debug(
              'Invalid Claude output: message - ' +
                JSON.stringify(message) +
                ' part - ' +
                JSON.stringify(part)
            );
        }
      }

      // If we accumulated aggregatedContent or aggregatedToolCalls, add the message
      if (aggregatedContent.length > 0 || aggregatedToolCalls.length > 0) {
        let accumulatedMessage: LLMMessage = {
          role,
        };

        if (aggregatedContent.length > 0) {
          accumulatedMessage.content = aggregatedContent.join('');
        }

        // Only add aggregatedToolCalls property for assistant messages
        if (aggregatedToolCalls.length > 0) {
          accumulatedMessage.tool_calls = aggregatedToolCalls;
        }
        extractedMessages.push(accumulatedMessage);
      }
    }
    return extractedMessages;
  }
}
