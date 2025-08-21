import { z } from "zod";
import { EvaluationRequest, LLMMessage, LLMToolCall, LLMToolDefinition } from "../../types";
import { CanonicalEvaluationStrategy, convertResponseMessagesToLLMMessages } from "../canonical";
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
      } else if (request.messages) {
        messages.push(...convertResponseMessagesToLLMMessages(request.messages));
      }

      let mergedContent = [];
      for await (const textPart of response.textStream) {
        mergedContent.push(textPart);
      }
      
      if (mergedContent.length > 0) {
        messages.push({
            role: 'assistant',
            content: mergedContent.join('')
          });
      }

      // Once we know we have a stream text property we are in a streamText response and can check tool calls async.
      if (response.toolCalls) {
        let toolCalls = await response.toolCalls
        for (const toolCall of toolCalls) {
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

      if (response.toolResults) {
        let toolResults = await response.toolResults
        for (const toolResult of toolResults) {
          messages.push({
            role: 'tool',
            tool_calls: [{
              name: toolResult.toolName,
              arguments: toolResult.output,
              id: toolResult.toolCallId
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
          messages.push(...convertResponseMessagesToLLMMessages(response?.request?.body?.input))
      }

      // generateText response is a string
      if (response?.response?.messages) {
          messages.push(...convertResponseMessagesToLLMMessages(response.response.messages));
      }

      // for generateText
      if (response.messages) {
          messages.push(...convertResponseMessagesToLLMMessages(response.messages));
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
}