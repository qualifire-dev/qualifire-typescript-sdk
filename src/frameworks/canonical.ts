import { EvaluationRequest, LLMToolDefinition } from '../types';

export interface CanonicalEvaluationStrategy {
  convertToQualifireEvaluationRequest(
    request: any,
    response: any
  ): EvaluationRequest;
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
        parameters: toolObj.parameters || toolObj.args || {}
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
