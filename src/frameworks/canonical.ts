import { EvaluationRequest, LLMMessage, LLMToolCall, LLMToolDefinition } from '../types';

export interface CanonicalEvaluationStrategy {
  convertToQualifireEvaluationRequest(
    request: any,
    response: any
  ): Promise<EvaluationRequest>;
}
export function convertToolsToLLMDefinitions(tools: unknown[]): LLMToolDefinition[] {
  const results: LLMToolDefinition[] = [];
  
  for (const tool of tools) {
    // Check if it's a valid tool object
    if (!tool || typeof tool !== 'object') {
      continue;
    }
    
    const toolObj = tool as any;
    
    // Handle FunctionTool type
    if (toolObj.type === 'function' && toolObj.function) {
      const functionDef = toolObj.function;
      
      const llmTool: LLMToolDefinition = {
        name: functionDef.name,
        description: functionDef.description,
        parameters: functionDef.parameters
      };
      
      results.push(llmTool);
    }
    
    // Handle other tool types that might have different structures
    else if (toolObj.name && typeof toolObj.name === 'string') {
      // Generic tool with name property
      const llmTool: LLMToolDefinition = {
        name: toolObj.name,
        description: toolObj.description,
        parameters: toolObj.parameters?.properties || toolObj.parameters || toolObj.args || {}
      };
      
      results.push(llmTool);
    }
    
    // Handle Vercel AI SDK tool format
    else if (toolObj.description && toolObj.parameters) {
      // Extract name from tool (might need to be provided or generated)
      const name = toolObj.name || `tool_${results.length}`;
      
      const llmTool: LLMToolDefinition = {
        name: name,
        description: toolObj.description,
        parameters: toolObj.parameters
      };
      
      results.push(llmTool);
    }
  }
  
  return results;
}

// Input can be all of the options mentioned in the parameter ResponseInputItem is also possible but not exported in openai-node so added as any[]
export function convertResponseMessagesToLLMMessages(messages: any[]): LLMMessage[] {
  let extracted_messages: LLMMessage[] = [];

  for (const message of messages) {
    // response api
    if (message.type == 'function_call') { 
      extracted_messages.push({
        role: "assistant" as const,
        tool_calls: [{
          name: message.name,
          arguments: JSON.parse(message.arguments),
          id: message.call_id,
        }],
      });
    continue
    }
    if (typeof message.content === 'string') {
      extracted_messages.push({
        role: message.role,
        content: message.content,
      });
      continue;
    }
    let content: string[] = [];
    let tool_calls: LLMToolCall[] = [];
    let role: string = message.role;
    let messageContents = [];
    if (message.content) {
      messageContents = message.content;
    } else if (message.parts) {
      messageContents = message.parts;
    } else {
      continue;
    }
    for (const part of messageContents) {
      switch (message.type) {
        case 'message':
          if (messageContents) {
            for (const contentElement of messageContents) {
              switch (contentElement.type) {
                case 'output_text':    
                  role = "tool" as const; // This is an output of a tool call so it's made by a tool.
                  content.push(contentElement.text);
                  break;
                case 'text':
                case 'input_text':
                  content.push(contentElement.text);
                  break;
                default:
                  throw new Error("Invalid output: " + JSON.stringify(contentElement));
              }
            }
            if (content.length > 0) {
              extracted_messages.push({
                role,
                content: content.join(' '),
                tool_calls,
              });
            }        
          }
          break;
        // function calls based on https://platform.openai.com/docs/api-reference/responses/create
        case 'web_search_call':
          extracted_messages.push({
            role: "assistant" as const,
            tool_calls: [{
            name: message.name,
              arguments: {},
              id: message.id,
            }],
          });
          break;
        case 'file_search_call':
          let toolArguments = message.queries? {"queries": message?.queries} : {};
          extracted_messages.push({
            role: "assistant" as const,
            tool_calls: [{
            name: message.name,
            arguments: toolArguments,
            id: message.id,
            }],
          });
          break;
        case 'function_call': 
          extracted_messages.push({
            role: "assistant" as const,
            tool_calls: [{
              name: message.name,
              arguments: JSON.parse(message.arguments),
              id: message.id,
            }],
          });
          break;
        case 'text':
          content.push(part.text || '');
          break
        case 'tool-call':
          tool_calls.push({
            name: message.toolName,
            arguments: message.input,
            id: message.toolCallId
          });
          break
        case 'tool-result':
          tool_calls.push({
            name: message.toolName,
            arguments: message.output,
            id: message.toolCallId
          });
          break
        default:
          // claude has messages with only one content. In that case we can add a message based on that single content. 
          if (messageContents.length == 1) {
            switch (part.type) {
              case 'tool_use':
                extracted_messages.push({
                  role: "assistant" as const,
                  tool_calls: [{
                    name: part.name,
                    arguments: part.input,
                    id: part.id,
                  }],
                });
                break;
              case 'tool_result':
                extracted_messages.push({
                  role: "tool" as const,
                  content: JSON.stringify(part.content),
                });
                break;
              default:
                throw new Error("Invalid output: message - " + JSON.stringify(message) + " part - " + JSON.stringify(part));
            }
          }
        }
      }
    }
  return extracted_messages;
}
