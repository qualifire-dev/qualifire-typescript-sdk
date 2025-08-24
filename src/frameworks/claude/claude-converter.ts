import { EvaluationRequest, LLMMessage, LLMToolDefinition } from '../../types';
import {
  CanonicalEvaluationStrategy,
  convertResponseMessagesToLLMMessages,
} from '../canonical';

export class ClaudeCanonicalEvaluationStrategy
  implements CanonicalEvaluationStrategy {
  async convertToQualifireEvaluationRequest(
    request: any,
    response: any
  ): Promise<EvaluationRequest> {
    const messages: LLMMessage[] = [];
    const availableTools: LLMToolDefinition[] = [];

    // Handle Claude system message first (if present)
    if (request?.system) {
      messages.push({
        role: 'system',
        content: request.system,
      });
    }

    if (request?.tools) {
      for (const tool of request.tools) {
        availableTools.push({
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema?.properties || {},
        });
      }
    }

    // Handle Claude request messages
    if (request?.messages) {
      messages.push(...convertResponseMessagesToLLMMessages(request.messages));
    }

    // Checking if streaming response
    if (this.isClaudeStreamingChunk(response)) {
      if (response.type === 'message_start' && response.message) {
        messages.push(
          ...convertResponseMessagesToLLMMessages([response.message])
        );
      }
    } else {
      messages.push(...convertResponseMessagesToLLMMessages([response]));
    }

    return {
      messages,
      available_tools: availableTools,
    };
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
