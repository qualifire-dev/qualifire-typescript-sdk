import { EvaluationRequest, LLMMessage, LLMToolDefinition } from "../../types";
import { CanonicalEvaluationStrategy } from "../canonical";

export class VercelAICanonicalEvaluationStrategy implements CanonicalEvaluationStrategy {
    convertToQualifireEvaluationRequest(request: any, response: any): EvaluationRequest {

    let messages: LLMMessage[] = [];
    
    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: String(request.systemPrompt)
      })
    }

    if (request.prompt) {
      messages.push({
        role: 'user',
        content: String(request.prompt)
      })
    }
    
    let available_tools: LLMToolDefinition[] = [];
    if (request.tools) {
      available_tools = convertToolsToLLMDefinitions(request.tools);
    }

    if (Array.isArray(response)) {
      if (response.length > 0 && typeof response[0] === 'string') {
        const responseAsStrings: string[] = response
        const mergedContent = responseAsStrings
        .filter(item => typeof item === 'string')
        .join('');
      
        if (mergedContent) {
          messages.push({
            role: 'assistant',
            content: mergedContent
          });
        }
      }
    } else {
      // generateText response is a string
      if (response?.request?.messages) {
          messages.push(...convertResponseMessagesToLLMMessages(response.request.messages))
      }

      // generateText response is a string
      if (response?.response?.messages) {
          messages.push(...convertResponseMessagesToLLMMessages(response.response.messages));
      }

      // generateText callTools
      let tool_calls = [];
      if (response?.toolCalls) {
        tool_calls = response.toolCalls;
      } else if (response?.response?.toolCalls) {
        tool_calls = response.response.toolCalls
      }
      for (const toolCall of tool_calls) {
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

    // useChat messages is a string
    if (response.messages) {
        messages.push(...convertResponseMessagesToLLMMessages(response.messages));
    }

    if (messages.length === 0) {
      throw new Error("No messages found in the response");
    }

    return {
        messages: messages,
        available_tools: available_tools
    }
  }
}

function convertToolsToLLMDefinitions(tools: Record<string, any>): LLMToolDefinition[] {
  const results: LLMToolDefinition[] = [];
  for (const [toolName, tool] of Object.entries(tools)) {
    results.push({
      name: toolName,
      description: tool.description || '',
      parameters: tool.inputSchema?.shape || {},
    })
  }
  return results;
}
export function convertResponseMessagesToLLMMessages(messages: any[]): LLMMessage[] {
  let extracted_messages: LLMMessage[] = [];

  for (const message of messages) {
    if (typeof message.content === 'string') {
      extracted_messages.push({
        role: message.role,
        content: message.content,
      });
    } else {
      let content: string[] = [];
      let messageContents = [];
      if (message.content) {
        messageContents = message.content;
      } else if (message.parts) {
        messageContents = message.parts;
      }
      for (const part of messageContents) {
        if (part.type === 'text') {
          content.push(part.text || '');
        }
      }
      extracted_messages.push({
        role: message.role,
        content: content.join(' '),
      });
    }
  }
  return extracted_messages;
}

