import {
  EvaluationProxyAPIRequest,
  LLMMessage,
  LLMToolDefinition,
} from '../../types';
import {
  CanonicalEvaluationStrategy,
  convertResponseMessagesToLLMMessages,
} from '../canonical';

export class ClaudeCanonicalEvaluationStrategy
  implements CanonicalEvaluationStrategy<any, any> {
  async convertToQualifireEvaluationRequest(
    request: any,
    response: any
  ): Promise<EvaluationProxyAPIRequest> {
    let {
      messages: requestMessages,
      available_tools: requestAvailableTools,
    } = await this.convertRequest(request);

    const messages: LLMMessage[] = requestMessages || [];
    const available_tools: LLMToolDefinition[] = requestAvailableTools || [];

    // Check if response is streaming or non-streaming
    if (Array.isArray(response)) {
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

  async convertRequest(request: any): Promise<EvaluationProxyAPIRequest> {
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

  private async handleStreaming(response: any[]): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    for (const chunk of response) {
      // Handle streaming chunk with message_start type
      if (chunk?.type === 'message_start' && chunk.message) {
        messages.push(...convertResponseMessagesToLLMMessages([chunk.message]));
      }
    }

    return messages;
  }

  private async handleNonStreamingResponse(
    response: any
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

    if (response?.role) {
      messages.push(...convertResponseMessagesToLLMMessages([response]));
    }

    return messages;
  }
}
