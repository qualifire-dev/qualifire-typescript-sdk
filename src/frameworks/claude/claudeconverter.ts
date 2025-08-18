import {
  EvaluationRequest,
  LLMMessage
} from '../../types';
import { CanonicalEvaluationStrategy } from '../canonical';

export class ClaudeCanonicalEvaluationStrategy
  implements CanonicalEvaluationStrategy {
  convertToQualifireEvaluationRequest(
    request: any,
    response: any
  ): EvaluationRequest {
    let messages: LLMMessage[] = [];
    
    // Handle Claude system message first (if present)
    if (request?.system) {
      messages.push({
        role: 'system',
        content: request.system,
      });
    }
    
    // Handle Claude request messages
    if (request?.messages) {
      for (const message of request.messages) {
        if (message.role && message.content) {
          // Handle different content types (string or array)
          let content: string;
          if (typeof message.content === 'string') {
            content = message.content;
          } else if (Array.isArray(message.content)) {
            content = message.content
              .map((c: any) => c.type === 'text' ? c.text : '')
              .filter((text: any) => text)
              .join(' ');
          } else {
            content = String(message.content);
          }
              
          messages.push({
            role: message.role,
            content: content,
          });
        } else {
          throw new Error("Invalid Claude request message: " + JSON.stringify(message));
        }
      }
    }

    // Handle Claude response content array
    if (response?.content && Array.isArray(response.content)) {
      for (const contentBlock of response.content) {
        if (contentBlock.type === 'text' && contentBlock.text) {
          messages.push({
            role: 'assistant',
            content: contentBlock.text,
          });
        } else if (contentBlock.type === 'tool_use') {
          // Handle tool use blocks
          messages.push({
            role: 'assistant',
            content: `Tool used: ${contentBlock.name || 'unknown'}`,
          });
        }
      }
    }

    // Handle direct text response (fallback)
    if (typeof response === 'string') {
      messages.push({
        role: 'assistant',
        content: response,
      });
    }

    if (messages.length > 0) {
      return {
        messages: messages,
      };
    }
    throw new Error("Invalid Claude request or response - no valid messages found");
  }
}
