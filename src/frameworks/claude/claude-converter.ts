import { EvaluationRequest, LLMMessage, LLMToolDefinition } from '../../types';
import {
  CanonicalEvaluationStrategy,
  convertResponseMessagesToLLMMessages,
} from '../canonical';

export class ClaudeCanonicalEvaluationStrategy
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

    // Check if response is streaming or non-streaming
    if (this.isClaudeStreamingChunk(response)) {
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
      available_tools: available_tools,
    };
  }

  async convertRequest(request: any): Promise<EvaluationRequest> {
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
      messages.push(...convertResponseMessagesToLLMMessages(request.messages));
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

  private async handleStreaming(response: any): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    // Handle streaming response
    if (response.type === 'message_start' && response.message) {
      messages.push(
        ...convertResponseMessagesToLLMMessages([response.message])
      );
    }

    return messages;
  }

  private async handleNonStreamingResponse(
    response: any
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    // Handle non-streaming response
    messages.push(...convertResponseMessagesToLLMMessages([response]));

    return messages;
  }

  private isClaudeStreamingChunk(response: any): boolean {
    return (
      response?.type &&
      [
        'message_start',
        'content_block_start',
        'content_block_delta',
        'content_block_stop',
        'message_delta',
        'message_stop',
      ].includes(response.type)
    );
  }
}
