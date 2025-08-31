import { z } from 'zod';
import {
  EvaluationProxyAPIRequest,
  LLMMessage,
  LLMToolDefinition,
  LLMToolCallSchema,
  LLMToolCall,
} from '../../types';
import { CanonicalEvaluationStrategy } from '../canonical';
import {
  AssistantModelMessage,
  ModelMessage,
  SystemModelMessage,
  ToolModelMessage,
  UserModelMessage,
  TextPart,
  ToolCallPart,
} from '@ai-sdk/provider-utils';

type VercelAICanonicalEvaluationStrategyResponse = any;
type VercelAICanonicalEvaluationStrategyRequest = any;

export class VercelAICanonicalEvaluationStrategy
  implements
    CanonicalEvaluationStrategy<
      VercelAICanonicalEvaluationStrategyRequest,
      VercelAICanonicalEvaluationStrategyResponse
    > {
  async convertToQualifireEvaluationRequest(
    request: VercelAICanonicalEvaluationStrategyRequest,
    response: VercelAICanonicalEvaluationStrategyResponse
  ): Promise<EvaluationProxyAPIRequest> {
    const {
      messages: requestMessages,
      available_tools: requestAvailableTools,
    } = await this.convertRequest(request);

    const messages: LLMMessage[] = requestMessages || [];
    const available_tools: LLMToolDefinition[] = requestAvailableTools || [];

    // Check if response is streaming (has textStream property)
    if (response?.textStream) {
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
    request: VercelAICanonicalEvaluationStrategyRequest
  ): Promise<EvaluationProxyAPIRequest> {
    const messages: LLMMessage[] = [];
    let available_tools: LLMToolDefinition[] = [];

    // Handle system message
    if (request?.system) {
      messages.push({
        role: 'system',
        content: request.system,
      });
    }

    // Handle prompt or messages
    if (request?.prompt) {
      messages.push({
        role: 'user',
        content: request.prompt,
      });
    } else if (request?.messages) {
      messages.push(
        ...this.convertRequestMessageToLLMMessages(
          request.messages //as ModelMessage[]
        )
      );
    }

    // Handle tools
    if (request?.tools) {
      available_tools = this.convertToolsToLLMDefinitions(request.tools);
    }

    return {
      messages,
      available_tools,
    };
  }

  private async handleStreaming(
    response: VercelAICanonicalEvaluationStrategyResponse
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    // Handle streaming text content
    const mergedContent = [];

    const textStreams = response.textStream.tee();
    for await (const textPart of textStreams[0]) {
      mergedContent.push(textPart);
    }

    if (mergedContent.length > 0) {
      messages.push({
        role: 'assistant',
        content: mergedContent.join('').trim(),
      });
    }

    // Handle tool calls from streaming response
    if (response.toolCalls) {
      const toolCalls = await response.toolCalls;
      for (const toolCall of toolCalls) {
        messages.push({
          role: 'assistant',
          tool_calls: [
            {
              name: toolCall.toolName,
              arguments: toolCall.input,
              id: toolCall.toolCallId,
            },
          ],
        });
      }
    }

    // Handle tool calls from streaming response
    if (response.toolResults) {
      const toolResults = await response.toolResults;
      for (const toolResult of toolResults) {
        messages.push({
          role: 'tool',
          content: JSON.stringify(toolResult.output),
        });
      }
    }

    return messages;
  }

  private async handleNonStreamingResponse(
    response: VercelAICanonicalEvaluationStrategyResponse
  ): Promise<LLMMessage[]> {
    if (
      response.response.messages &&
      Array.isArray(response.response.messages)
    ) {
      return this.convertRequestMessageToLLMMessages(
        response.response.messages as ModelMessage[]
      );
    }
    return [];
  }

  private convertToolsToLLMDefinitions(
    tools: Record<string, any>
  ): LLMToolDefinition[] {
    const results: LLMToolDefinition[] = [];
    for (const [toolName, tool] of Object.entries(tools)) {
      let parameters: Record<string, any> = {};
      // A Zod type
      if (tool.inputSchema instanceof z.ZodType) {
        const jsonSchema = z.toJSONSchema(tool.inputSchema);
        parameters = jsonSchema.properties || {}; // To avoid some issue in Zod that does not convert properly to JSONSchema
        // A JSONSchema type
      } else if (tool.inputSchema?.jsonSchema?.properties) {
        parameters = tool.inputSchema.jsonSchema.properties;
      }
      results.push({
        name: toolName,
        description: tool.description || '',
        parameters,
      });
    }
    return results;
  }

  // VercelAI-specific function to convert Responses API messages to LLM messages
  private convertRequestMessageToLLMMessages(
    messages: ModelMessage[]
  ): LLMMessage[] {
    const extracted_messages: LLMMessage[] = [];

    for (const message of messages) {
      if (typeof message.content === 'string') {
        extracted_messages.push({
          role: message.role,
          content: message.content,
        });
        continue;
      }

      switch (message.role) {
        case 'system':
          const systemMessage = message as SystemModelMessage;
          extracted_messages.push({
            role: 'system',
            content: systemMessage.content,
          });
          break;
        case 'user':
          const userMessage = message as UserModelMessage;
          if (typeof userMessage.content === 'string') {
            extracted_messages.push({
              role: 'user',
              content: userMessage.content,
            });
          } else {
            const textParts = userMessage.content.filter(
              part => part.type === 'text'
            ) as TextPart[];
            extracted_messages.push({
              role: 'user',
              content: textParts
                .map(part => part.text)
                .join('')
                .trim(),
            });
          }
          break;
        case 'assistant':
          const assistantMessage = message as AssistantModelMessage;
          if (typeof assistantMessage.content === 'string') {
            extracted_messages.push({
              role: 'assistant',
              content: assistantMessage.content,
            });
          } else {
            const textParts = assistantMessage.content.filter(
              part => part.type === 'text' || part.type === 'reasoning'
            ) as TextPart[];
            const toolCalls = extractToolCalls(
              assistantMessage.content.filter(
                part => part.type === 'tool-call'
              ) as ToolCallPart[]
            );

            extracted_messages.push({
              role: 'assistant',
              content: textParts
                .map(part => part.text)
                .join('')
                .trim(),
              tool_calls: toolCalls,
            });
          }
          break;
        case 'tool':
          const toolMessage = message as ToolModelMessage;
          const toolContent = extractToolContent(toolMessage);
          extracted_messages.push({
            role: 'tool',
            content: toolContent,
          });
          break;
        default:
          throw new Error(
            'Invalid VercelAI output: message - ' + JSON.stringify(message)
          );
      }
    }
    return extracted_messages;
  }
}

// This parses a ToolModelMessage object into a string
function extractToolContent(toolMessage: ToolModelMessage): string {
  if (toolMessage.role !== 'tool') {
    return ''; // Illegal message given.
  }
  const content = toolMessage.content;
  if (content.length !== 1) {
    return '';
  }
  const firstContent = content[0];
  if (firstContent.type !== 'tool-result') {
    return '';
  }
  // LanguageModelV2ToolResultOutput is not exported unfortunaly so we have to use this type
  const output = firstContent.output;
  switch (output.type) {
    case 'json':
    case 'error-json':
      return JSON.stringify(output.value);
    case 'text':
    case 'error-text':
      return output.value;
    case 'content':
      const textParts = output.value.filter(
        part => part.type === 'text'
      ) as TextPart[];
      return textParts.map(part => part.text).join('');
    default:
      console.debug('Illegal output:', output);
      return '';
  }
}

function extractToolCalls(content: ToolCallPart[]): LLMToolCall[] {
  let toolCalls: LLMToolCall[] = [];
  for (const part of content) {
    if (part.type !== 'tool-call') {
      continue;
    }
    let toolCall: unknown = {
      name: part.toolName,
      arguments: part.input,
      id: part.toolCallId,
    };
    const parsed = LLMToolCallSchema.safeParse(toolCall);
    if (parsed.success) {
      toolCalls.push(parsed.data);
    }
  }
  return toolCalls;
}
