# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # Compile TypeScript to dist/
npm test               # Run all tests
npm run test:watch     # Run tests in watch mode
npm run lint           # Run ESLint
npm run lint:fix       # Run ESLint with auto-fix
npm run format         # Format with Prettier
npm run type-check     # TypeScript type checking without emit
```

Run a single test file:
```bash
npx jest tests/ExpressRestApiBuilder.test.ts
```

Run tests matching a pattern:
```bash
npx jest -t "pattern"
```

## Architecture

This is a REST API builder library for Express.js using the builder pattern to control middleware and route registration order.

### Core Components

- **ExpressRestApiBuilder** (`src/ExpressRestApiBuilder.ts`): Main class that wraps Express. Uses private class fields (`#`). Key flow:
  1. Constructor initializes Express app with JSON parsing
  2. `getApp()` returns the Express Application for adding custom middleware
  3. `build()` registers all routes and error handler (can only be called once)

- **Service Pattern**: Each API endpoint is a class with a `run(input)` method. Services receive dependencies via constructor injection.

- **Two execution modes**:
  - `createService`: Factory function for dependency injection (recommended)
  - `runService`: Full control over service execution

### Route Registration

Routes are tuples: `[method, path, ServiceClass]`

- `services`: Routes that go through `loadSession` (mounted at `/api`)
- `unauthenticatedServices`: Public routes (mounted at `/api/anon`)
- WebSocket routes use method `'WS'`

### Response Format

All responses follow: `{ success: boolean, result?: any, error?: { message, code } }`

### Error Handling

- `RestApiError`: Structured error with HTTP status code
- `mapError`: Optional function to transform domain errors to `RestApiError`
