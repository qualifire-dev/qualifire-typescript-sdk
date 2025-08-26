import { z } from 'zod';
import {
  EvaluationProxyAPIRequest,
  LLMMessage,
  LLMToolDefinition,
} from '../../types';
import {
  CanonicalEvaluationStrategy,
  convertResponseMessagesToLLMMessages,
} from '../canonical';

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

    if (response.text && typeof response.text === 'string') {
      messages.push({
        role: 'assistant',
        content: response.text,
      });
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
