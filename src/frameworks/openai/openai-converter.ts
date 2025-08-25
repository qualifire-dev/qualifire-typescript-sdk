import {
  EvaluationRequestV1,
  LLMMessage,
  LLMToolDefinition,
} from '../../types';
import {
  CanonicalEvaluationStrategy,
  convertResponseMessagesToLLMMessages,
  convertToolsToLLMDefinitions,
} from '../canonical';

import type { GenerateTextResult, StreamTextResult, ToolSet } from 'ai';
import {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionCreateParamsBase,
} from 'openai/resources/chat/completions/completions';
import { Completion } from 'openai/resources/completions';
import { ResponseCreateParamsBase } from 'openai/resources/responses/responses';

type OpenAICanonicalEvaluationStrategyResponse = any;
type OpenAICanonicalEvaluationStrategyRequest = any;

export class OpenAICanonicalEvaluationStrategy
  implements
    CanonicalEvaluationStrategy<
      OpenAICanonicalEvaluationStrategyRequest,
      OpenAICanonicalEvaluationStrategyResponse
    > {
  async convertRequest(
    request: OpenAICanonicalEvaluationStrategyRequest
  ): Promise<EvaluationRequestV1> {
    const messages: LLMMessage[] = [];
    let available_tools: LLMToolDefinition[] = [];

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

    if (request?.tools) {
      available_tools = convertToolsToLLMDefinitions(request?.tools);
    }
    return {
      messages,
      available_tools,
    };
  }

  async convertToQualifireEvaluationRequest(
    request: OpenAICanonicalEvaluationStrategyRequest,
    response: OpenAICanonicalEvaluationStrategyResponse
  ): Promise<EvaluationRequestV1> {
    let {
      messages: requestMessages,
      available_tools: requestAvailableTools,
    } = await this.convertRequest(request);

    const messages: LLMMessage[] = requestMessages || [];
    const available_tools: LLMToolDefinition[] = requestAvailableTools || [];

    if (Array.isArray(response)) {
      let streamingResultMessages = await this.handleStreaming(response);
      messages.push(...streamingResultMessages);
    } else {
      let nonStreamingResultMessages = await this.handleNonStreamingResponse(
        response
      );
      messages.push(...nonStreamingResultMessages);
    }

    return {
      messages,
      available_tools,
    };
  }

  private async handleStreaming(
    response: OpenAICanonicalEvaluationStrategyResponse
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];
    for (const chunk of response) {
      messages.push(...(await this.handleNonStreamingResponse(chunk)));
    }
    return messages;
  }

  private async handleNonStreamingResponse(
    response: OpenAICanonicalEvaluationStrategyResponse
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];

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

    return messages;
  }
}
