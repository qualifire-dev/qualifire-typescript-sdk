import { EvaluationRequest, LLMMessage } from "../../types";
import { CanonicalEvaluationStrategy } from "../canonical";

// TODO: implement this properly
export class VercelAICanonicalEvaluationStrategy implements CanonicalEvaluationStrategy {
    convertToQualifireEvaluationRequest(request: any, response: any): EvaluationRequest {

    let messages: LLMMessage[] = [];
    
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

    // generate text has text. stream text does not. 
    if (response.text && typeof response.text === 'string') {
        messages = [
            {
                role: 'assistant',
                content: response.text
            }
        ]
    }

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

    // TODO: add tools support

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
