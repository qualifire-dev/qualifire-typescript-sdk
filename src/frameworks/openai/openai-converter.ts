import { EvaluationRequest, LLMMessage, LLMToolDefinition } from '../../types';
import {
  CanonicalEvaluationStrategy,
  convertResponseMessagesToLLMMessages,
  convertToolsToLLMDefinitions,
} from '../canonical';

import type { GenerateTextResult, StreamTextResult, ToolSet } from 'ai';
import { ChatCompletionCreateParamsNonStreaming, ChatCompletionCreateParamsStreaming } from 'openai/resources/chat/completions/completions';
import { Completion } from 'openai/resources/completions';
import { ResponseCreateParamsBase } from 'openai/resources/responses/responses';


/*
create(body: CompletionCreateParamsNonStreaming, options?: Core.RequestOptions): APIPromise<Completion>;
    create(body: CompletionCreateParamsStreaming, options?: Core.RequestOptions): APIPromise<Stream<Completion>>;
    create(body: CompletionCreateParamsBase, options?: Core.RequestOptions): APIPromise<Stream<Completion> | Completion>;
*/

// type OpenAICanonicalEvaluationStrategyRequest = ChatCompletionCreateParamsNonStreaming | ChatCompletionCreateParamsStreaming | ResponseCreateParamsBase;
// type OpenAICanonicalEvaluationStrategyResponse = GenerateTextResult<ToolSet, any> | StreamTextResult<ToolSet, any> | Completion;

// TOOD - remove temp
type OpenAICanonicalEvaluationStrategyRequest = any;
type OpenAICanonicalEvaluationStrategyResponse = any;

export class OpenAICanonicalEvaluationStrategy
  implements CanonicalEvaluationStrategy<OpenAICanonicalEvaluationStrategyRequest, OpenAICanonicalEvaluationStrategyResponse> {
  async convertToQualifireEvaluationRequest(
    request: OpenAICanonicalEvaluationStrategyRequest,
    response: OpenAICanonicalEvaluationStrategyResponse
  ): Promise<EvaluationRequest> {
    const messages: LLMMessage[] = [];

    // response api
    // chat completions api
    if (request?.instructions) {
      messages.push({
        role: 'system',
        content: request.instructions,
      });
    }

    if (request?.input) {
      if (typeof request.input === 'string') {
        messages.push({
          role: 'user',
          content: request.input,
        });
      } else {
        messages.push(...convertResponseMessagesToLLMMessages(request.input));
      }
    }

    if (request?.messages) {
      for (const message of request.messages) {
        if (message.role && message.content) {
          messages.push({
            role: message.role,
            content: message.content,
          });
        } else {
          throw new Error('Invalid request: ' + JSON.stringify(message));
        }
      }
    }

    // chat completions api
    if (response?.choices) {
      for (const choice of response.choices) {
        if (choice.message?.role) {
          const message: LLMMessage = {
            role: choice.message.role,
          };
          if (choice.message?.content) {
            message.content = choice.message.content;
          }
          if (choice.message?.tool_calls) {
            message.tool_calls = choice.message.tool_calls.map(
              (tool_call: any) => ({
                name: tool_call.function.name,
                arguments: JSON.parse(tool_call.function.arguments),
                id: tool_call.id,
              })
            );
          }
          if (message.content || message.tool_calls) {
            messages.push(message);
          } else {
            throw new Error('Invalid response: ' + JSON.stringify(choice));
          }
        }
      }
    }

    //response api
    if (response.output) {
      messages.push(...convertResponseMessagesToLLMMessages(response.output));
    } else if (
      response.sequence_number &&
      response.type == 'response.completed'
    ) {
      // For streaming responses
      if (response.response?.output) {
        messages.push(
          ...convertResponseMessagesToLLMMessages(response.response.output)
        );
      } else {
        throw new Error('Invalid response: ' + JSON.stringify(response));
      }
    }

    let available_tools: LLMToolDefinition[] = [];
    if (request?.tools) {
      available_tools = convertToolsToLLMDefinitions(request?.tools);
    }

    return {
      messages,
      available_tools,
    };
  }
}
