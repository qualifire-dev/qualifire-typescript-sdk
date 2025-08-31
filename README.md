Qualifire

[![CodeQL](https://github.com/qualifire-dev/qualifire-typescript-sdk/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/qualifire-dev/qualifire-typescript-sdk/actions/workflows/codeql-analysis.yml)
[![Release](https://github.com/qualifire-dev/qualifire-typescript-sdk/actions/workflows/release.yml/badge.svg)](https://github.com/qualifire-dev/qualifire-typescript-sdk/actions/workflows/release.yml)
[![Issues][issues-img]][issues-url]
[![Code Coverage][codecov-img]][codecov-url]
[![Commitizen Friendly][commitizen-img]][commitizen-url]
[![Semantic Release][semantic-release-img]][semantic-release-url]

# Qualifire SDK

This is the official SDK for interacting with the Qualifire API.

## Installation

```bash
npm install qualifire
```

## usage

First, import the `Qualifire` class from the SDK:

```javascript
import { Qualifire } from 'qualifire-sdk';
```

Then, create a new instance of the Qualifire class, passing your API key and the base URL of the Qualifire API:

```javascript
const qualifire = new Qualifire({
  apiKey: 'your-api-key',
});
```

ℹ️ There are default environment variables if you prefer to set it that way `QUALIFIRE_API_KEY`

You can now use the `evaluate` method to evaluate input and output data:

```javascript
const input = {
  model: 'gpt-3.5-turbo',
  messages: [
    {
      role: 'user',
      content: 'this is my awesome request',
    },
  ],
};

const output = await openai.chat.completions.create(input);

const evaluationResponse = await qualifire.evaluate(input, output); // This will block until the evaluation is done
console.log(evaluationResponse);
```

### Non-blocking execution

In case you want to trigger a completely async evaluation (to view in qualifire's UI) simply add the `{async: true}` option to your call.

```javascript
const input = {
  model: 'gpt-3.5-turbo',
  messages: [
    {
      role: 'user',
      content: 'this is my awesome request',
    },
  ],
};

const output = await openai.chat.completions.create(input);

const evaluationResponse = await qualifire.evaluate(input, output, {
  async: true,
}); // This will block until the evaluation is done
console.log(evaluationResponse);
```

Evaluates the input and output using the Qualifire API. Returns a promise that resolves to the evaluation response, or undefined if async is true.

- In VercelAI - Do notice that giving stream response to `evaluate()` may lock the `response.textStream`!

[build-img]: https://github.com/qualifire-dev/develop/qualifire-typescript-sdk/actions/workflows/release.yml/badge.svg
[build-url]: https://github.com/qualifire-dev/qualifire-typescript-sdk/actions/workflows/release.yml
[downloads-img]: https://img.shields.io/npm/dt/main/qualifire
[npm-url]: https://www.npmjs.com/package/qualifire
[issues-img]: https://img.shields.io/github/issues/qualifire-dev/develop/qualifire-typescript-sdk
[issues-url]: https://github.com/qualifire-dev/qualifire-typescript-sdk/issues
[codecov-img]: https://codecov.io/gh/qualifire-dev/develop/qualifire-typescript-sdk/branch/main/graph/badge.svg
[codecov-url]: https://codecov.io/gh/qualifire-dev/develop/qualifire-typescript-sdk
[semantic-release-img]: https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg
[semantic-release-url]: https://github.com/semantic-release/semantic-release
[commitizen-img]: https://img.shields.io/badge/commitizen-friendly-brightgreen.svg
[commitizen-url]: http://commitizen.github.io/cz-cli/
