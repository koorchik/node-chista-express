import request from 'supertest';
import { ExpressRestApiBuilder } from '../src/ExpressRestApiBuilder';
import { RestApiError } from '../src/RestApiError';
import type { Logger } from '../src/types';

describe('RestApiServer Integration', () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };
  });

  describe('HTTP Request Lifecycle', () => {
    test('should handle GET request successfully', async () => {
      class UsersListHandler {
        async run() {
          return [{ id: 1, name: 'John' }];
        }
      }

      const testServer = new ExpressRestApiBuilder({
        logger: mockLogger,
        loadSession: async () => ({ userId: 1 }),
        runService: async (Service, context) => {
          const { request, session } = context;
          const input = {
            ...request.query,
            ...request.params,
            ...request.body,
          };
          const handler = new Service({ session });
          return await handler.run(input);
        },
        services: [['GET', '/users', UsersListHandler]],
      });
      testServer.build();

      const response = await request(testServer.getApp()).get('/api/users').expect(200);

      expect(response.body).toEqual({
        success: true,
        result: [{ id: 1, name: 'John' }],
      });
    });

    test('should handle POST request with body', async () => {
      class UserCreateHandler {
        async run(input: any) {
          return { id: 1, ...input };
        }
      }

      const testServer = new ExpressRestApiBuilder({
        logger: mockLogger,
        loadSession: async () => ({ userId: 1 }),
        runService: async (Service, context) => {
          const { request, session } = context;
          const input = {
            ...request.query,
            ...request.params,
            ...request.body,
          };
          const handler = new Service({ session });
          return await handler.run(input);
        },
        services: [['POST', '/users', UserCreateHandler]],
      });
      testServer.build();

      const response = await request(testServer.getApp())
        .post('/api/users')
        .send({ name: 'Jane', email: 'jane@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result.name).toBe('Jane');
    });

    test('should handle route parameters', async () => {
      class UserGetHandler {
        async run(input: any) {
          return { id: input.userId, name: 'User' };
        }
      }

      const testServer = new ExpressRestApiBuilder({
        logger: mockLogger,
        loadSession: async () => ({ userId: 1 }),
        runService: async (Service, context) => {
          const { request, session } = context;
          const input = {
            ...request.query,
            ...request.params,
            ...request.body,
          };
          const handler = new Service({ session });
          return await handler.run(input);
        },
        services: [['GET', '/users/:userId', UserGetHandler]],
      });
      testServer.build();

      const response = await request(testServer.getApp()).get('/api/users/123').expect(200);

      expect(response.body.result.id).toBe('123');
    });

    test('should handle PUT request', async () => {
      class UserUpdateHandler {
        async run(input: any) {
          return { id: input.userId, ...input };
        }
      }

      const testServer = new ExpressRestApiBuilder({
        logger: mockLogger,
        loadSession: async () => ({ userId: 1 }),
        runService: async (Service, context) => {
          const { request, session } = context;
          const input = {
            ...request.query,
            ...request.params,
            ...request.body,
          };
          const handler = new Service({ session });
          return await handler.run(input);
        },
        services: [['PUT', '/users/:userId', UserUpdateHandler]],
      });
      testServer.build();

      const response = await request(testServer.getApp())
        .put('/api/users/123')
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.result.id).toBe('123');
      expect(response.body.result.name).toBe('Updated Name');
    });

    test('should handle DELETE request', async () => {
      class UserDeleteHandler {
        async run(input: any) {
          return { deleted: true, id: input.userId };
        }
      }

      const testServer = new ExpressRestApiBuilder({
        logger: mockLogger,
        loadSession: async () => ({ userId: 1 }),
        runService: async (Service, context) => {
          const { request, session } = context;
          const input = {
            ...request.query,
            ...request.params,
            ...request.body,
          };
          const handler = new Service({ session });
          return await handler.run(input);
        },
        services: [['DELETE', '/users/:userId', UserDeleteHandler]],
      });
      testServer.build();

      const response = await request(testServer.getApp()).delete('/api/users/123').expect(200);

      expect(response.body.result.deleted).toBe(true);
    });
  });

  describe('Anonymous Routes', () => {
    test('should handle anonymous routes', async () => {
      class LoginHandler {
        async run(input: any) {
          return { token: 'abc123', user: input.username };
        }
      }

      const testServer = new ExpressRestApiBuilder({
        logger: mockLogger,
        runService: async (Service, context) => {
          const { request, session } = context;
          const input = {
            ...request.query,
            ...request.params,
            ...request.body,
          };
          const handler = new Service({ session });
          return await handler.run(input);
        },
        unauthenticatedServices: [['POST', '/login', LoginHandler]],
      });
      testServer.build();

      const response = await request(testServer.getApp())
        .post('/api/public/login')
        .send({ username: 'john', password: 'secret' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result.token).toBe('abc123');
    });
  });

  describe('Error Handling', () => {
    test('should handle service errors gracefully', async () => {
      class ErrorHandler {
        async run() {
          throw new Error('Service error');
        }
      }

      const testServer = new ExpressRestApiBuilder({
        logger: mockLogger,
        loadSession: async () => ({ userId: 1 }),
        runService: async (Service, context) => {
          const { request, session } = context;
          const input = {
            ...request.query,
            ...request.params,
            ...request.body,
          };
          const handler = new Service({ session });
          return await handler.run(input);
        },
        services: [['GET', '/error', ErrorHandler]],
      });
      testServer.build();

      const response = await request(testServer.getApp()).get('/api/error').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeTruthy();
      expect(response.body.error.message).toBe('Service error');
    });

    test('should handle RestApiError with custom code', async () => {
      class NotFoundHandler {
        async run() {
          throw new RestApiError({ message: 'Resource not found', code: 'NOT_FOUND' }, 404);
        }
      }

      const testServer = new ExpressRestApiBuilder({
        logger: mockLogger,
        loadSession: async () => ({ userId: 1 }),
        runService: async (Service, context) => {
          const { request, session } = context;
          const input = {
            ...request.query,
            ...request.params,
            ...request.body,
          };
          const handler = new Service({ session });
          return await handler.run(input);
        },
        services: [['GET', '/notfound', NotFoundHandler]],
      });
      testServer.build();

      const response = await request(testServer.getApp()).get('/api/notfound').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Resource not found');
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    test('should handle validation errors', async () => {
      class ValidationErrorHandler {
        async run() {
          throw new RestApiError(
            {
              message: 'Validation failed',
              code: 'VALIDATION_ERROR',
              fields: { email: 'Invalid email format' },
            },
            422
          );
        }
      }

      const testServer = new ExpressRestApiBuilder({
        logger: mockLogger,
        loadSession: async () => ({ userId: 1 }),
        runService: async (Service, context) => {
          const { request, session } = context;
          const input = {
            ...request.query,
            ...request.params,
            ...request.body,
          };
          const handler = new Service({ session });
          return await handler.run(input);
        },
        services: [['POST', '/validate', ValidationErrorHandler]],
      });
      testServer.build();

      const response = await request(testServer.getApp())
        .post('/api/validate')
        .send({ email: 'invalid' })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.fields).toBeTruthy();
      expect(response.body.error.fields.email).toBe('Invalid email format');
    });
  });

  describe('Query Parameters', () => {
    test('should handle query parameters', async () => {
      class SearchHandler {
        async run(input: any) {
          return { query: input.q, limit: input.limit };
        }
      }

      const testServer = new ExpressRestApiBuilder({
        logger: mockLogger,
        loadSession: async () => ({ userId: 1 }),
        runService: async (Service, context) => {
          const { request, session } = context;
          const input = {
            ...request.query,
            ...request.params,
            ...request.body,
          };
          const handler = new Service({ session });
          return await handler.run(input);
        },
        services: [['GET', '/search', SearchHandler]],
      });
      testServer.build();

      const response = await request(testServer.getApp())
        .get('/api/search?q=test&limit=10')
        .expect(200);

      expect(response.body.result.query).toBe('test');
      expect(response.body.result.limit).toBe('10');
    });
  });

  describe('Session Validation', () => {
    test('should validate session with token in header', async () => {
      class ProtectedHandler {
        constructor(private context: any) {}
        async run() {
          return { userId: this.context.session?.userId };
        }
      }

      const loadSession = jest.fn(async (req) => {
        const token = req.headers['x-access-token'] as string;
        if (token === 'valid-token') {
          return { userId: 123, token };
        }
        throw new RestApiError({ message: 'Invalid token', code: 'INVALID_TOKEN' }, 401);
      });

      const serverWithAuth = new ExpressRestApiBuilder({
        logger: mockLogger,
        loadSession,
        runService: async (Service, context) => {
          const { request, session } = context;
          const input = {
            ...request.query,
            ...request.params,
            ...request.body,
          };
          const handler = new Service({ session });
          return await handler.run(input);
        },
        services: [['GET', '/protected', ProtectedHandler]],
      });
      serverWithAuth.build();

      const response = await request(serverWithAuth.getApp())
        .get('/api/protected')
        .set('x-access-token', 'valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result.userId).toBe(123);
      expect(loadSession).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-access-token': 'valid-token',
          }),
        })
      );
    });

    test('should validate session with token in query', async () => {
      class ProtectedHandler {
        async run() {
          return { success: true };
        }
      }

      const loadSession = jest.fn(async (req) => {
        const token = req.query.token as string;
        if (token === 'query-token') {
          return { userId: 456, token };
        }
        throw new RestApiError({ message: 'Invalid token', code: 'INVALID_TOKEN' }, 401);
      });

      const serverWithAuth = new ExpressRestApiBuilder({
        logger: mockLogger,
        loadSession,
        runService: async (Service, context) => {
          const { request, session } = context;
          const input = {
            ...request.query,
            ...request.params,
            ...request.body,
          };
          const handler = new Service({ session });
          return await handler.run(input);
        },
        services: [['GET', '/protected', ProtectedHandler]],
      });
      serverWithAuth.build();

      await request(serverWithAuth.getApp())
        .get('/api/protected?token=query-token')
        .expect(200);

      expect(loadSession).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            token: 'query-token',
          }),
        })
      );
    });

    test('should reject invalid session token', async () => {
      class ProtectedHandler {
        async run() {
          return { data: 'secret' };
        }
      }

      const loadSession = jest.fn(async () => {
        throw new RestApiError({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
      });

      const serverWithAuth = new ExpressRestApiBuilder({
        logger: mockLogger,
        loadSession,
        runService: async (Service, context) => {
          const { request, session } = context;
          const input = {
            ...request.query,
            ...request.params,
            ...request.body,
          };
          const handler = new Service({ session });
          return await handler.run(input);
        },
        services: [['GET', '/protected', ProtectedHandler]],
      });
      serverWithAuth.build();

      const response = await request(serverWithAuth.getApp())
        .get('/api/protected')
        .set('x-access-token', 'invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Unauthorized');
    });
  });

  describe('Middleware Error Handling', () => {
    test('should handle invalid JSON with logger', async () => {
      class TestHandler {
        async run() {
          return { success: true };
        }
      }

      const serverWithLogger = new ExpressRestApiBuilder({
        logger: mockLogger,
        jsonParser: { limit: '1mb' },
        runService: async (Service, context) => {
          const { request, session } = context;
          const input = {
            ...request.query,
            ...request.params,
            ...request.body,
          };
          const handler = new Service({ session });
          return await handler.run(input);
        },
        unauthenticatedServices: [['POST', '/test', TestHandler]],
      });
      serverWithLogger.build();

      await request(serverWithLogger.getApp())
        .post('/api/public/test')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('createService Pattern', () => {
    test('should work with createService instead of runService', async () => {
      class UsersList {
        constructor(private deps: any) {}
        async run() {
          return [{ id: 1, dbConnected: !!this.deps.db }];
        }
      }

      const testServer = new ExpressRestApiBuilder({
        logger: mockLogger,
        loadSession: async () => ({ userId: 1 }),
        createService: (Service, { session }) => {
          return new Service({ session, db: 'mock-db' });
        },
        services: [['GET', '/users', UsersList]],
      });
      testServer.build();

      const response = await request(testServer.getApp()).get('/api/users').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result[0].dbConnected).toBe(true);
    });

    test('should use mapError to transform domain errors', async () => {
      class DomainError extends Error {
        code = 'DOMAIN_ERROR';
        toObject() {
          return { code: this.code, message: this.message };
        }
      }

      class FailingService {
        async run() {
          throw new DomainError('Something went wrong');
        }
      }

      const testServer = new ExpressRestApiBuilder({
        logger: mockLogger,
        loadSession: async () => ({ userId: 1 }),
        createService: (Service) => new Service(),
        mapError: (error) => {
          if (error instanceof DomainError) {
            return new RestApiError(error.toObject(), 200);
          }
          return undefined;
        },
        services: [['GET', '/fail', FailingService]],
      });
      testServer.build();

      const response = await request(testServer.getApp()).get('/api/fail').expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DOMAIN_ERROR');
    });

    test('should log 5xx RestApiError at error level', async () => {
      class ServerErrorService {
        async run() {
          throw new RestApiError({ message: 'Server error', code: 'SERVER_ERROR' }, 500);
        }
      }

      const testServer = new ExpressRestApiBuilder({
        logger: mockLogger,
        loadSession: async () => ({ userId: 1 }),
        createService: (Service) => new Service(),
        services: [['GET', '/server-error', ServerErrorService]],
      });
      testServer.build();

      await request(testServer.getApp()).get('/api/server-error').expect(500);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Request error')
      );
    });

    test('should use custom extractInput', async () => {
      class EchoService {
        async run(input: any) {
          return input;
        }
      }

      const testServer = new ExpressRestApiBuilder({
        logger: mockLogger,
        loadSession: async () => ({ userId: 1 }),
        createService: (Service, _context) => new Service(),
        extractInput: (context) => ({
          customField: 'custom-value',
          query: context.request.query,
        }),
        services: [['GET', '/echo', EchoService]],
      });
      testServer.build();

      const response = await request(testServer.getApp()).get('/api/echo?foo=bar').expect(200);

      expect(response.body.result.customField).toBe('custom-value');
      expect(response.body.result.query.foo).toBe('bar');
    });
  });
});
