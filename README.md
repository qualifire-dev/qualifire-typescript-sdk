# my-package-name

[![CodeQL](https://github.com/drorIvry/qualifire-typescript-sdk/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/drorIvry/qualifire-typescript-sdk/actions/workflows/codeql-analysis.yml)
[![Release](https://github.com/drorIvry/qualifire-typescript-sdk/actions/workflows/release.yml/badge.svg)](https://github.com/drorIvry/qualifire-typescript-sdk/actions/workflows/release.yml)
[![Issues][issues-img]][issues-url]
[![Code Coverage][codecov-img]][codecov-url]
[![Commitizen Friendly][commitizen-img]][commitizen-url]
[![Semantic Release][semantic-release-img]][semantic-release-url]

> My awesome module

## Install

```bash
npm install my-package-name
```

## Usage

```ts
import * as qualifire from 'qualifire';

const qualifireClient = qualifire.getClient('#YOUR-SDK-KEY#');

const prompt = await qualifireClient.getValueAsync(
  'isMyAwesomeFeatureEnabled',
  {
    var1: 'val1',
    var2: 'val2',
  }
);

const chatCompletion = await openai.createChatCompletion({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: prompt }],
});
```

[build-img]: https://github.com/drorivry/develop/qualifire-typescript-sdk/actions/workflows/release.yml/badge.svg
[build-url]: https://github.com/drorivry/qualifire-typescript-sdk/actions/workflows/release.yml
[downloads-img]: https://img.shields.io/npm/dt/main/qualifire
[npm-url]: https://www.npmjs.com/package/qualifire
[issues-img]: https://img.shields.io/github/issues/drorivry/develop/qualifire-typescript-sdk
[issues-url]: https://github.com/drorivry/qualifire-typescript-sdk/issues
[codecov-img]: https://codecov.io/gh/drorivry/develop/qualifire-typescript-sdk/branch/main/graph/badge.svg
[codecov-url]: https://codecov.io/gh/drorivry/develop/qualifire-typescript-sdk
[semantic-release-img]: https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg
[semantic-release-url]: https://github.com/semantic-release/semantic-release
[commitizen-img]: https://img.shields.io/badge/commitizen-friendly-brightgreen.svg
[commitizen-url]: http://commitizen.github.io/cz-cli/
