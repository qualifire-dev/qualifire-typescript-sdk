# Qualifire SDK

[![CodeQL](https://github.com/qualifire-dev/qualifire-typescript-sdk/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/qualifire-dev/qualifire-typescript-sdk/actions/workflows/codeql-analysis.yml)
[![Release](https://github.com/qualifire-dev/qualifire-typescript-sdk/actions/workflows/release.yml/badge.svg)](https://github.com/qualifire-dev/qualifire-typescript-sdk/actions/workflows/release.yml)
[![Issues][issues-img]][issues-url]
[![Code Coverage][codecov-img]][codecov-url]
[![Commitizen Friendly][commitizen-img]][commitizen-url]
[![Semantic Release][semantic-release-img]][semantic-release-url]

The official TypeScript SDK for evaluating LLM outputs with [Qualifire](https://qualifire.ai). Detect hallucinations, prompt injections, PII leakage, content policy violations, and more.

## Installation

```bash
npm install qualifire
```

## Quick Start

```typescript
import { Qualifire } from 'qualifire';
import OpenAI from 'openai';

const qualifire = new Qualifire({ apiKey: 'your-api-key' });
const openai = new OpenAI();

// Make your LLM call
const request = {
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the capital of France?' },
  ],
};

const response = await openai.chat.completions.create(request);

// Evaluate the response
const evaluation = await qualifire.evaluate({
  framework: 'openai',
  request,
  response,
  hallucinationsCheck: true,
  groundingCheck: true,
});

console.log(evaluation);
// {
//   status: 'passed',
//   score: 100,
//   evaluationResults: [...]
// }
```

## Supported Frameworks

| Framework | Value | SDK |
|-----------|-------|-----|
| OpenAI | `openai` | `openai` (Chat Completions & Responses API) |
| Anthropic Claude | `claude` | `@anthropic-ai/sdk` |
| Google Gemini | `gemini` | `@google/genai` |
| Vercel AI SDK | `vercelai` | `ai` |

All frameworks support both streaming and non-streaming responses.

## Available Evaluation Checks

| Check | Parameter | Description |
|-------|-----------|-------------|
| Hallucinations | `hallucinationsCheck` | Detect fabricated information |
| Grounding | `groundingCheck` | Verify responses are grounded in context |
| Prompt Injections | `promptInjections` | Detect prompt injection attempts |
| PII Detection | `piiCheck` | Identify personally identifiable information |
| Content Moderation | `contentModerationCheck` | Flag harmful content |
| Instructions Following | `instructionsFollowingCheck` | Verify adherence to system instructions |
| Tool Selection Quality | `toolSelectionQualityCheck` | Evaluate tool/function call accuracy |
| Custom Assertions | `assertions` | Array of custom assertion strings |

## Framework Examples

### OpenAI

```typescript
// Chat Completions API
const request = {
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
};
const response = await openai.chat.completions.create(request);

await qualifire.evaluate({
  framework: 'openai',
  request,
  response,
  hallucinationsCheck: true,
});

// Streaming
const streamRequest = { ...request, stream: true };
const stream = await openai.chat.completions.create(streamRequest);

const chunks = [];
for await (const chunk of stream) {
  chunks.push(chunk);
}

await qualifire.evaluate({
  framework: 'openai',
  request: streamRequest,
  response: chunks,
  hallucinationsCheck: true,
});
```

### Anthropic Claude

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

const request = {
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }],
};
const response = await anthropic.messages.create(request);

await qualifire.evaluate({
  framework: 'claude',
  request,
  response,
  promptInjections: true,
});
```

### Google Gemini

```typescript
import { GoogleGenAI } from '@google/genai';

const genai = new GoogleGenAI({ apiKey: 'your-key' });

const request = {
  model: 'gemini-2.0-flash',
  contents: [{ role: 'user', parts: [{ text: 'Hello!' }] }],
};
const response = await genai.models.generateContent(request);

await qualifire.evaluate({
  framework: 'gemini',
  request,
  response,
  contentModerationCheck: true,
});
```

### Vercel AI SDK

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const request = {
  model: openai('gpt-4o'),
  prompt: 'Hello!',
};
const response = await generateText(request);

await qualifire.evaluate({
  framework: 'vercelai',
  request,
  response,
  piiCheck: true,
});
```

## Direct Message Mode

For cases where you don't use a supported framework, pass messages directly:

```typescript
await qualifire.evaluate({
  messages: [
    { role: 'user', content: 'What is 2+2?' },
    { role: 'assistant', content: 'The answer is 4.' },
  ],
  hallucinationsCheck: true,
  groundingCheck: true,
});
```

## Invoke Pre-configured Evaluations

Run evaluations configured in the Qualifire dashboard:

```typescript
const result = await qualifire.invokeEvaluation({
  input: 'What is the capital of France?',
  output: 'Paris is the capital of France.',
  evaluationId: 'eval-123',
});
```

## Configuration

### Constructor Options

```typescript
const qualifire = new Qualifire({
  apiKey: 'your-api-key',      // Required (or set QUALIFIRE_API_KEY env var)
  baseUrl: 'https://...',      // Optional, defaults to https://proxy.qualifire.ai
});
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `QUALIFIRE_API_KEY` | API key for authentication |
| `QUALIFIRE_BASE_URL` | Override the API base URL |

## Response Format

```typescript
interface EvaluationResponse {
  status: 'passed' | 'failed';
  score: number;  // 0-100
  evaluationResults: Array<{
    type: string;
    results: Array<{
      name: string;
      score: number;
      label: string;
      confidence_score: number;
      reason: string;
    }>;
  }>;
}
```

## License

MIT

[issues-img]: https://img.shields.io/github/issues/qualifire-dev/qualifire-typescript-sdk
[issues-url]: https://github.com/qualifire-dev/qualifire-typescript-sdk/issues
[codecov-img]: https://codecov.io/gh/qualifire-dev/qualifire-typescript-sdk/branch/main/graph/badge.svg
[codecov-url]: https://codecov.io/gh/qualifire-dev/qualifire-typescript-sdk
[semantic-release-img]: https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg
[semantic-release-url]: https://github.com/semantic-release/semantic-release
[commitizen-img]: https://img.shields.io/badge/commitizen-friendly-brightgreen.svg
[commitizen-url]: http://commitizen.github.io/cz-cli/
