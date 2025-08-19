import { z } from "zod";
import { EvaluationRequest, LLMMessage, LLMToolCall, LLMToolDefinition } from "../../types";
import { CanonicalEvaluationStrategy } from "../canonical";
export class VercelAICanonicalEvaluationStrategy implements CanonicalEvaluationStrategy {
    async convertToQualifireEvaluationRequest(request: any, response: any): Promise<EvaluationRequest> {

    let messages: LLMMessage[] = [];
    
    let available_tools: LLMToolDefinition[] = [];
    if (request.tools) {
      available_tools = this.convertToolsToLLMDefinitions(request.tools);
    }

    // streamText response has a textStream property
    if (response.textStream) {
      if (request.system) {
        messages.push({
          role: 'system',
          content: String(request.system)
        })
      }
  
      if (request.prompt) {
        messages.push({
          role: 'user',
          content: String(request.prompt)
        })
      }
        let mergedContent = [];
        for await (const textPart of response.textStream) {
          mergedContent.push(textPart);
        }
        
        messages.push({
            role: 'assistant',
            content: mergedContent.join('')
          });

      // Once we know we have a stream text property we are in a streamText response and can check tool calls async.
      if (response.toolCalls) {
        let toolsCalls = await response.toolCalls
        for (const toolCall of toolsCalls) {
          messages.push({
            role: 'assistant',
            tool_calls: [{
              name: toolCall.toolName,
              arguments: toolCall.input,
              id: toolCall.toolCallId
            }]
          });
        }
      }
    // generateText response
    } else {
      // generateText response has a text string property
      if (response.text && typeof response.text === 'string') {
        messages.push({
          role: 'assistant',
          content: String(response.text)
        });
      }

      // generateText response is a string
      if (response?.request?.body?.input) {
          messages.push(...this.convertResponseMessagesToLLMMessages(response?.request?.body?.input))
      }

      // generateText response is a string
      if (response?.response?.messages) {
          messages.push(...this.convertResponseMessagesToLLMMessages(response.response.messages));
      }

      // for generateText
      if (response.messages) {
          messages.push(...this.convertResponseMessagesToLLMMessages(response.messages));
      }
    }

    return {
        messages: messages,
        available_tools: available_tools
    }
  }

  private convertToolsToLLMDefinitions(tools: Record<string, any>): LLMToolDefinition[] {
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
      })
    }
    return results;
  }

  private convertResponseMessagesToLLMMessages(messages: any[]): LLMMessage[] {
    let extracted_messages: LLMMessage[] = [];

    for (const message of messages) {
      if (typeof message.content === 'string') {
        extracted_messages.push({
          role: message.role,
          content: message.content,
        });
      } else {
        let content: string[] = [];
        let tool_calls: LLMToolCall[] = [];
        let messageContents = [];
        if (message.content) {
          messageContents = message.content;
        } else if (message.parts) {
          messageContents = message.parts;
        }
        for (const part of messageContents) {
          if (part.type === 'text' || part.type === 'input_text') {
            content.push(part.text || '');
          } else if (part.type === 'tool-call') {
            tool_calls.push({
              name: part.toolName,
              arguments: part.input,
              id: part.toolCallId
            });
          } else if (part.type === 'tool-result') {
            tool_calls.push({
              name: part.toolName,
              arguments: part.output,
              id: part.toolCallId
            });
          }
        }
        extracted_messages.push({
          role: message.role,
          content: content.join(' '),
          tool_calls: tool_calls,
        });
      }
    }
    return extracted_messages;
  }
}

