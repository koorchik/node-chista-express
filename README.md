# chista-express

[![npm version](https://badge.fury.io/js/chista-express.svg)](https://badge.fury.io/js/chista-express)
[![npm downloads](https://img.shields.io/npm/dm/chista-express.svg)](https://www.npmjs.com/package/chista-express)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/chista-express)](https://bundlephobia.com/package/chista-express)
[![Known Vulnerabilities](https://snyk.io/test/github/koorchik/node-chista-express/badge.svg?targetFile=package.json)](https://snyk.io/test/github/koorchik/node-chista-express?targetFile=package.json)

A REST API builder for Express.js that uses the builder pattern to give you full control over middleware and route registration order.

## Why Builder Pattern?

Express middleware executes in registration order. This matters because:
- CORS headers must be set before any response
- Authentication must run before protected routes
- Error handlers must be registered after routes

The builder pattern solves this by separating **configuration** from **route registration**:

```typescript
const builder = new ExpressRestApiBuilder({ ...config });
const app = builder.getApp();  // Standard Express Application

// 1. Add global middleware BEFORE routes
app.use(cors());
app.use(compression());

// 2. Register service routes
builder.build();

// 3. Add catch-all routes AFTER services
app.use('/static', express.static('public'));
app.use('*', (req, res) => res.status(404).send('Not found'));
```

**Key benefit**: `getApp()` returns a standard Express `Application` - no special types, no lock-in. You have full access to Express APIs.

## Features

- **Builder Pattern** - Control middleware order with before/after route registration
- **Standard Express** - Returns plain `Application`, fully compatible with Express ecosystem
- **Service Pattern** - Each endpoint is a class with `run()` method
- **Dependency Injection** - Services receive dependencies via constructor
- **Session Management** - Built-in session loading with `loadSession`
- **WebSocket Support** - Integrated express-ws for WebSocket endpoints
- **Structured Errors** - Custom error handling with RestApiError

## Installation

```bash
npm install chista-express
```

## Examples

See the [examples](./examples) folder:

- **[simple](./examples/simple)** - Basic usage with plain service classes
- **[chista](./examples/chista)** - Integration with [chista](https://www.npmjs.com/package/chista) for validation and lifecycle hooks

## Quick Start

```typescript
import { ExpressRestApiBuilder, RestApiError } from 'chista-express';

// Define your service
class UsersList {
  constructor(private deps: { db: Database }) {}

  async run() {
    return this.deps.db.query('SELECT * FROM users');
  }
}

// Create builder
const builder = new ExpressRestApiBuilder({
  logger: console,

  // Service factory - inject your dependencies here
  createService: (Service, { session }) => {
    return new Service({ session, db: myDatabase });
  },

  // Required for authenticated routes (services)
  loadSession: async (req) => {
    const token = req.headers['x-access-token'];
    return { userId: 1, token };
  },

  services: [
    ['GET', '/users', UsersList]
  ]
});

// Get Express app and add custom middleware
const app = builder.getApp();

// Finalize routes
builder.build();

// Start server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Extending the Express App

The builder gives you access to a standard Express app at two points:

### Before `build()` - Global Middleware

Middleware added here runs **before** all service routes:

```typescript
const builder = new ExpressRestApiBuilder({ ...config });
const app = builder.getApp();

// These run BEFORE any service route
app.use(cors({ origin: '*' }));
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

builder.build();
```

Use this for: CORS, security headers, compression, request logging, rate limiting, basic auth.

### After `build()` - Additional Routes & Handlers

Routes added here are registered **after** service routes:

```typescript
builder.build();

// These run AFTER service routes (only if no service matched)
app.use('/', express.static('public'));
app.use('/docs', swaggerUi.serve);
app.use('*', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  // Custom error handler
});

app.listen(3000);
```

Use this for: static files, documentation UI, catch-all 404, custom error handlers.

## Graceful Shutdown

Capture the server instance and handle termination signals:

```typescript
import type { Server } from 'http';

const server: Server = app.listen(3000);

function gracefulShutdown(signal: string) {
  console.log(`${signal} received`);
  server.close(() => {
    // Clean up resources (db connections, etc.)
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000); // Force exit after timeout
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

See the [examples](./examples) for complete implementations.

## Configuration Options

### Basic Configuration

```typescript
const builder = new ExpressRestApiBuilder({
  apiBaseUrl: '/api',                   // Base URL for authenticated routes (default: '/api')
  unauthenticatedApiBaseUrl: '/api/public',  // Base URL for unauthenticated routes (default: apiBaseUrl + '/public')
  logger: yourLogger,                   // Optional: Logger with info(string) and error(string)
  jsonParser: { limit: '10mb' }         // Optional: default value is 1mb
});
```

### Service Execution

There are two ways to configure how services are executed:

#### Option 1: createService (Recommended)

Use `createService` for simple dependency injection with optional customization:

```typescript
const builder = new ExpressRestApiBuilder({
  logger,

  // Factory function to instantiate services with dependencies
  createService: (Service, { session }) => {
    return new Service({
      session,
      db: database,
      mappers: dataMappers,
      userId: session?.userId
    });
  },

  // Optional: Transform domain errors to RestApiError
  mapError: (error) => {
    if (error instanceof MyDomainError) {
      return new RestApiError(error.toObject(), 200);
    }
    return undefined; // Use default 500 handling
  },

  // Optional: Customize input extraction (has sensible defaults)
  extractInput: (context) => ({
    ...context.request.query,
    ...context.request.params,
    ...context.request.body
  }),

  services: [...]
});
```

#### Option 2: runService (Full Control)

Use `runService` when you need complete control over service execution:

```typescript
const builder = new ExpressRestApiBuilder({
  logger,

  runService: async (Service, context) => {
    const { request, session } = context;
    const service = new Service({ session, db });
    const input = { ...request.query, ...request.params, ...request.body };
    return await service.run(input);
  },

  services: [...]
});
```

### Default Input Extraction

When using `createService`, the default `extractInput` provides:

```typescript
{
  ...context.request.query,      // URL query parameters
  ...context.request.params,     // Route parameters
  ...context.request.body,       // Request body
  ws: context.ws,                // WebSocket instance (for WS routes)
  userAgent: '...',              // User-Agent header
  clientIp: '...'                // Client IP address
}
```

### Authentication with loadSession

**Required** when `services` is defined. The `loadSession` function runs before each authenticated route:

```typescript
const builder = new ExpressRestApiBuilder({
  // ...

  loadSession: async (req) => {
    const token = req.headers['x-access-token'] || req.query.token;

    if (!token) {
      throw new RestApiError(
        { message: 'Unauthorized', code: 'NO_TOKEN' },
        401
      );
    }

    const session = await validateToken(token);
    return { userId: session.userId, token };
  },

  services: [...],                    // Routes requiring authentication (loadSession required)
  unauthenticatedServices: [...]      // Public routes (mounted at /api/public by default)
});
```

## Service Pattern

Each service is a class with a `run()` method:

```typescript
class UserCreate {
  constructor(private deps: { db: Database; userId: number }) {}

  async run(input: { name: string; email: string }) {
    return this.deps.db.insert('users', {
      ...input,
      createdBy: this.deps.userId
    });
  }
}
```

## Route Definitions

Routes are defined as tuples:

```typescript
const routes = [
  ['GET', '/users', UsersList],
  ['GET', '/users/:id', UsersShow],
  ['POST', '/users', UsersCreate],
  ['PUT', '/users/:id', UsersUpdate],
  ['DELETE', '/users/:id', UsersDelete],
  ['PATCH', '/users/:id', UsersPatch],
  ['WS', '/ws/chat/:roomId', ChatService]  // WebSocket route
];
```

## WebSocket-Aware Middleware

Some middleware doesn't work with WebSocket upgrade requests. Use `skipForWebSocket` to bypass them:

```typescript
import { ExpressRestApiBuilder, skipForWebSocket } from 'chista-express';
import basicAuth from 'express-basic-auth';

const app = builder.getApp();

// Basic auth breaks WebSocket handshake - skip it for WS requests
app.use(skipForWebSocket(basicAuth({
  users: { admin: 'password' },
  challenge: true
})));

builder.build();
```

## API Response Format

**Success:**
```json
{
  "success": true,
  "result": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": { ... }
}
```

## WebSocket Support

```typescript
class ChatService {
  async run({ ws, roomId, session }) {
    ws.on('message', (msg) => {
      ws.send(`Echo: ${msg}`);
    });
  }
}

// WebSocket routes in services array
services: [
  ['GET', '/users', UsersList],
  ['WS', '/ws/chat/:roomId', ChatService]
]
```

## Error Handling

### Domain Errors with mapError

Transform your domain errors to API responses:

```typescript
import { ServiceError } from './your-domain';

const builder = new ExpressRestApiBuilder({
  createService: (Service, { session }) => new Service({ session }),

  mapError: (error) => {
    if (error instanceof ServiceError) {
      return new RestApiError(error.toObject(), 200);  // Business error
    }
    // Return undefined to use default 500 handling
    return undefined;
  },
  // ...
});
```

### RestApiError

For direct HTTP errors:

```typescript
import { RestApiError } from 'chista-express';

throw new RestApiError(
  { message: 'User not found', code: 'NOT_FOUND' },
  404
);
```

## Using with chista

The [chista](https://www.npmjs.com/package/chista) package is a great companion for building services with built-in LIVR validation and lifecycle hooks:

```bash
npm install chista
```

```typescript
import { ServiceBase, ServiceError } from 'chista';

const validation = {
  name: ['required', { min_length: 1 }],
  email: ['required', 'email'],
} as const;

class UsersCreate extends ServiceBase {
  static validation = validation;

  async execute(data: { name: string; email: string }) {
    // Validation runs automatically before execute()
    return this.db.users.create(data);
  }
}
```

Map `ServiceError` to API responses:

```typescript
import { ServiceError } from 'chista';

const builder = new ExpressRestApiBuilder({
  createService: (Service) => new Service({ db }),

  mapError: (error) => {
    if (error instanceof ServiceError) {
      return new RestApiError(error.toObject(), 200);
    }
    return undefined;
  },

  loadSession: async () => ({ userId: 1 }),

  services: [
    ['POST', '/users', UsersCreate],
  ],
});
```

See the [chista example](./examples/chista) for a complete implementation.

## Testing

This library is designed to be easily testable with supertest.

### Basic Test Setup

```typescript
import request from 'supertest';
import { ExpressRestApiBuilder, RestApiError } from 'chista-express';

describe('User API', () => {
  let builder: ExpressRestApiBuilder;
  const mockDb = new Map();

  beforeEach(() => {
    mockDb.clear();
    builder = new ExpressRestApiBuilder({
      loadSession: async () => ({ userId: 1 }),
      createService: (Service) => new Service({ db: mockDb }),
      services: [
        ['GET', '/users', UsersList],
        ['POST', '/users', UsersCreate],
      ],
    });
    builder.build();
  });

  test('should list users', async () => {
    const response = await request(builder.getApp())
      .get('/api/users')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.result).toBeInstanceOf(Array);
  });

  test('should create user', async () => {
    const response = await request(builder.getApp())
      .post('/api/users')
      .send({ name: 'John', email: 'john@example.com' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.result.name).toBe('John');
  });
});
```

### Testing Error Responses

```typescript
test('should return validation error', async () => {
  const response = await request(builder.getApp())
    .post('/api/users')
    .send({ email: 'invalid' }) // missing required name
    .expect(422);

  expect(response.body.success).toBe(false);
  expect(response.body.error.fields).toBeDefined();
});

test('should handle authentication errors', async () => {
  const authBuilder = new ExpressRestApiBuilder({
    loadSession: async () => {
      throw new RestApiError({ message: 'Unauthorized' }, 401);
    },
    createService: (Service) => new Service(),
    services: [['GET', '/protected', ProtectedService]],
  });
  authBuilder.build();

  await request(authBuilder.getApp())
    .get('/api/protected')
    .expect(401);
});
```

### Testing with Authentication Headers

```typescript
test('should accept token in header', async () => {
  const response = await request(builder.getApp())
    .get('/api/users')
    .set('x-access-token', 'valid-token')
    .expect(200);

  expect(response.body.success).toBe(true);
});
```

## TypeScript Types

All types are exported for use in your TypeScript code:

```typescript
import type {
  Logger,
  Session,
  RequestContext,
  Service,
  ServiceClass,
  CreateService,
  ExtractInput,
  MapError,
  RunService,
  RouteDefinition,
  RestApiServerConfig
} from 'chista-express';
```

### Key Interfaces

#### RequestContext

The context object passed to callbacks contains the Express request and additional data:

```typescript
interface RequestContext {
  request: Request;      // Express Request (has query, params, body, headers)
  session?: Session;     // Session data from loadSession
  ws?: any;              // WebSocket instance (for WS routes)
}
```

Access request data via `context.request`:
- `context.request.query` - URL query parameters
- `context.request.params` - Route parameters
- `context.request.body` - Request body
- `context.request.headers` - Request headers

#### CreateService

Factory function for dependency injection:

```typescript
type CreateService = (Service: ServiceClass, context: RequestContext) => Service;

// Example usage
const createService: CreateService = (Service, context) => {
  return new Service({
    session: context.session,
    db: database,
    logger: console,
  });
};
```

#### RunService

For full control over service execution (same signature as CreateService):

```typescript
type RunService = (Service: ServiceClass, context: RequestContext) => Promise<any>;

// Example usage
const runService: RunService = async (Service, context) => {
  const { request, session } = context;
  const input = { ...request.query, ...request.params, ...request.body };
  const service = new Service({ session, db: database });
  return await service.run(input);
};
```

#### ExtractInput

Customize how input is extracted from the request context:

```typescript
type ExtractInput = (context: RequestContext) => Record<string, any>;

// Example usage
const extractInput: ExtractInput = (context) => ({
  ...context.request.query,
  ...context.request.params,
  ...context.request.body,
  ws: context.ws,
});
```

#### RouteDefinition

Routes are defined as tuples:

```typescript
type RouteDefinition = [
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'WS',
  path: string,
  service: ServiceClass
];

// Example
const routes: RouteDefinition[] = [
  ['GET', '/users', UsersList],
  ['POST', '/users', UsersCreate],
  ['GET', '/users/:id', UsersShow],
  ['WS', '/ws', WebSocketHandler],
];
```

### Typed Service Example

```typescript
import type { Service } from 'chista-express';

interface UserInput {
  name: string;
  email: string;
}

interface User {
  id: number;
  name: string;
  email: string;
}

class UsersCreate implements Service<UserInput, User> {
  constructor(private deps: { db: Database; session: Session }) {}

  async run(input: UserInput): Promise<User> {
    return this.deps.db.users.create({
      ...input,
      createdBy: this.deps.session.userId,
    });
  }
}
```

## License

MIT
