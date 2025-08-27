import { z } from 'zod';
import {
  EvaluationProxyAPIRequest,
  LLMMessage,
  LLMToolDefinition,
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
        content: mergedContent.join(''),
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

    return messages;
  }

  private async handleNonStreamingResponse(
    response: VercelAICanonicalEvaluationStrategyResponse
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];
    // Handle messages with tool-call and tool-result content
    if (response.messages && Array.isArray(response.messages)) {
      for (const message of response.messages) {
        if (message.content && Array.isArray(message.content)) {
          for (const contentItem of message.content) {
            if (contentItem.type === 'tool-call') {
              // Handle tool-call content
              messages.push({
                role: 'assistant',
                tool_calls: [
                  {
                    name: contentItem.toolName,
                    arguments: contentItem.input,
                    id: contentItem.toolCallId,
                  },
                ],
              });
            } else if (contentItem.type === 'tool-result') {
              // Handle tool-result content
              messages.push({
                role: 'tool',
                content: JSON.stringify(contentItem.output),
                tool_calls: [
                  {
                    name: contentItem.toolName,
                    arguments: contentItem.input,
                    id: contentItem.toolCallId,
                  },
                ],
              });
            }
          }
        }
      }
    }

    return messages;
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
              content: textParts.map(part => part.text).join(''),
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
            const toolCalls = assistantMessage.content.filter(
              part => part.type === 'tool-call'
            ) as ToolCallPart[];
            extracted_messages.push({
              role: 'assistant',
              content: textParts.map(part => part.text).join(''),
              tool_calls: toolCalls.map(part => ({
                name: part.toolName,
                arguments: JSON.parse(part.input as string),
                id: part.toolCallId,
              })),
            });
          }
          break;
        case 'tool':
          const toolMessage = message as ToolModelMessage;
          extracted_messages.push({
            role: 'tool',
            tool_calls: toolMessage.content.map(part => {
              return {
                name: part.toolName,
                arguments: part.output,
                id: part.toolCallId,
              };
            }),
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
