import { EvaluationRequest, LLMMessage } from "../../types";
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

      return {
        messages: messages,
      }
    }
    // generateText response is a string
    if (response?.request?.messages) {
        messages.push(...convert_response_messages_to_llm_messages(response.request.messages))
    }

    // generateText response is a string
    if (response?.response?.messages) {
        messages.push(...convert_response_messages_to_llm_messages(response.response.messages));
    }

    // useChat messages is a string
    if (response.messages) {
        messages.push(...convert_response_messages_to_llm_messages(response.messages));
    }

    // TODO: add tools support
    if (messages.length === 0) {
      throw new Error("No messages found in the response");
    }

    return {
        messages: messages,
    }
  }
}

function convert_response_messages_to_llm_messages(messages: any[]): LLMMessage[] {
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
