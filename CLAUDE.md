# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Compile TypeScript (output to lib/)
pnpm test             # Run tests with coverage
pnpm test:watch       # Run tests in watch mode
pnpm lint             # Run ESLint with auto-fix
pnpm typecheck        # Type-check without emitting
```

Run a single test file:
```bash
pnpm test -- test/index.spec.ts
```

## Architecture

This is the official TypeScript SDK for the Qualifire API, which evaluates LLM outputs for quality metrics (grounding, hallucinations, PII, prompt injections, content moderation, etc.).

### Core Components

**Main Entry (`src/index.ts`)**: The `Qualifire` class is the public API. It provides:
- `evaluate()` - Main method supporting two modes:
  1. **Framework mode**: Pass `framework`, `request`, and `response` from supported LLM SDKs
  2. **Direct mode**: Pass `messages`, `input`, or `output` directly
- `invokeEvaluation()` - Invoke a pre-configured evaluation by ID
- `init()` - Initialize Traceloop telemetry

**Framework Converters (`src/frameworks/`)**: Strategy pattern implementations that convert SDK-specific request/response formats to Qualifire's canonical format:
- `openai-converter.ts` - Handles both Chat Completions and Responses APIs (streaming and non-streaming)
- `claude-converter.ts` - Anthropic Claude SDK
- `vercelai-converter.ts` - Vercel AI SDK
- `gemini-converter.ts` - Google Gemini SDK

Each converter implements `CanonicalEvaluationStrategy` interface from `canonical.ts`.

**Types (`src/types.ts`)**: Zod schemas define:
- `EvaluationRequestV2Schema` - Framework-based evaluation requests
- `EvaluationProxyAPIRequestSchema` - Direct/legacy evaluation requests
- Supported frameworks: `openai`, `vercelai`, `gemini`, `claude`

### Request Flow

1. `evaluate()` parses input to determine request type (framework vs direct)
2. For framework requests: converter transforms SDK types to canonical `LLMMessage[]` format
3. Request sent to Qualifire API at `{baseUrl}/api/evaluation/evaluate`
4. API key passed via `X-Qualifire-API-Key` header

### Environment Variables

- `QUALIFIRE_API_KEY` - API key (can also be passed to constructor)
- `QUALIFIRE_BASE_URL` - Override base URL (default: `https://proxy.qualifire.ai`)

## Conventions

- Uses conventional commits (commitizen configured)
- Semantic release for versioning
- Tests located in `test/` with `.spec.ts` suffix
