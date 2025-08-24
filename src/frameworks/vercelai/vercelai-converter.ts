import { z } from 'zod';
import { EvaluationRequest, LLMMessage, LLMToolDefinition } from '../../types';
import {
  CanonicalEvaluationStrategy,
  convertResponseMessagesToLLMMessages,
} from '../canonical';

export class VercelAICanonicalEvaluationStrategy
  implements CanonicalEvaluationStrategy<any, any> {
  async convertToQualifireEvaluationRequest(
    request: any,
    response: any
  ): Promise<EvaluationRequest> {
    let {
      messages: requestMessages,
      available_tools: requestAvailableTools,
    } = await this.convertRequest(request);

    const messages: LLMMessage[] = requestMessages || [];
    const available_tools: LLMToolDefinition[] = requestAvailableTools || [];

    // Check if response is streaming (has textStream property)
    if (response?.textStream) {
      let streamingResultMessages = await this.handleStreaming(response);
      messages.push(...streamingResultMessages);
    } else {
      let nonStreamingResultMessages = await this.handleNonStreamingResponse(
        response
      );
      messages.push(...nonStreamingResultMessages);
    }

    return {
      messages,
      available_tools,
    };
  }

  async convertRequest(request: any): Promise<EvaluationRequest> {
    const messages: LLMMessage[] = [];
    let available_tools: LLMToolDefinition[] = [];

    // Handle system message
    if (request?.system) {
      messages.push({
        role: 'system',
        content: String(request.system),
      });
    }

    // Handle prompt or messages
    if (request?.prompt) {
      messages.push({
        role: 'user',
        content: String(request.prompt),
      });
    } else if (request?.messages) {
      messages.push(...convertResponseMessagesToLLMMessages(request.messages));
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

  private async handleStreaming(response: any): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    // Handle streaming text content
    const mergedContent = [];
    for await (const textPart of response.textStream) {
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

    // Handle tool results from streaming response
    if (response.toolResults) {
      const toolResults = await response.toolResults;
      for (const toolResult of toolResults) {
        messages.push({
          role: 'tool',
          tool_calls: [
            {
              name: toolResult.toolName,
              arguments: toolResult.output,
              id: toolResult.toolCallId,
            },
          ],
        });
      }
    }

    return messages;
  }

  private async handleNonStreamingResponse(
    response: any
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    // Handle generateText response (has text string property)
    if (response.text && typeof response.text === 'string') {
      messages.push({
        role: 'assistant',
        content: String(response.text),
      });
    }

    // Handle response with messages
    if (response?.response?.messages) {
      messages.push(
        ...convertResponseMessagesToLLMMessages(response.response.messages)
      );
    }

    // Handle direct messages property
    if (response.messages) {
      messages.push(...convertResponseMessagesToLLMMessages(response.messages));
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
}
