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

    let chunks;
    if (Array.isArray(response)) {
      chunks = response;
    } else {
      chunks = [response];
    }

    // Process streaming chunks and accumulate content
    const accumulatedContent = this.processStreamingChunks(chunks);
    if (accumulatedContent) {
      messages.push({
        role: 'assistant',
        content: accumulatedContent,
      });
    } else {
      // Handle non-streaming responses
      for (const chunk of chunks) {
        if (!this.isClaudeStreamingChunk(chunk)) {
          // Handle Claude non-streaming response (complete message)
          if (chunk?.content && Array.isArray(chunk.content)) {
            for (const contentBlock of chunk.content) {
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
          else if (typeof chunk === 'string') {
            messages.push({
              role: 'assistant',
              content: chunk,
            });
          }
        }
      }
    }

    if (messages.length > 0) {
      return {
        messages: messages,
      };
    }
    throw new Error("Invalid Claude request or response - no valid messages found");
  }

  private processStreamingChunks(chunks: any[]): string | null {
    const contentBlocks: { [key: number]: string[] } = {};
    for (const chunk of chunks) {
      if (!this.isClaudeStreamingChunk(chunk)) {
        continue;
      }
      
      switch (chunk.type) {
        case 'content_block_start':
          // Initialize content block accumulator
          const startIndex = chunk.index || 0;
          if (!contentBlocks[startIndex]) {
            contentBlocks[startIndex] = [];
          }
          break;
        
        case 'content_block_delta':
          // Accumulate text content from delta
          if (chunk.delta?.type === 'text_delta' && chunk.delta?.text) {
            const deltaIndex = chunk.index || 0;
            if (!contentBlocks[deltaIndex]) {
              contentBlocks[deltaIndex] = [];
            }
            contentBlocks[deltaIndex].push(chunk.delta.text);
          }
          break;
        
        case 'content_block_stop':
          // Content block is complete, but we don't need to do anything special here
          // The content is already accumulated in contentBlocks
          break;
      }
    }
    
    // Combine all content blocks into a single message
    const allContent = Object.keys(contentBlocks)
      .sort((a, b) => parseInt(a) - parseInt(b)) // Sort by block index
      .map(index => contentBlocks[parseInt(index)].join(''))
      .filter(content => content.length > 0)
      .join('');

    return allContent || null;
  }

  private isClaudeStreamingChunk(response: any): boolean {
    return response?.type && [
      'message_start',
      'content_block_start', 
      'content_block_delta',
      'content_block_stop',
      'message_delta',
      'message_stop'
    ].includes(response.type);
  }
}
