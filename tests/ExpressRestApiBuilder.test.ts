import { ExpressRestApiBuilder } from '../src/ExpressRestApiBuilder';
import type { RestApiServerConfig, Logger } from '../src/types';

describe('ExpressRestApiBuilder', () => {
  let mockLogger: Logger;
  let config: RestApiServerConfig;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    config = {
      logger: mockLogger,
      runService: jest.fn(async (Service, context) => {
        const { request, session } = context;
        const input = {
          ...request.query,
          ...request.params,
          ...request.body,
        };
        const handler = new Service({ session });
        return await handler.run(input);
      }),
    };
  });

  describe('constructor', () => {
    test('should create server with valid config', () => {
      const builder = new ExpressRestApiBuilder(config);
      expect(builder).toBeDefined();
      expect(builder.getApp()).toBeDefined();
    });

    test('should work without logger', () => {
      const configWithoutLogger = { ...config, logger: undefined };
      const builder = new ExpressRestApiBuilder(configWithoutLogger);
      expect(builder).toBeDefined();
    });

    test('should throw if neither runService nor createService provided', () => {
      const badConfig = { ...config, runService: undefined as any };
      expect(() => new ExpressRestApiBuilder(badConfig)).toThrow('Either runService or createService is required');
    });

    test('should accept createService instead of runService', () => {
      const builder = new ExpressRestApiBuilder({
        logger: mockLogger,
        createService: (Service, context) => new Service({ session: context.session }),
      });
      expect(builder).toBeDefined();
    });

    test('should throw if services defined without loadSession', () => {
      class TestHandler {
        async run() {
          return {};
        }
      }
      expect(() => new ExpressRestApiBuilder({
        ...config,
        services: [['GET', '/test', TestHandler]],
      })).toThrow('loadSession is required when services are defined');
    });

    test('should initialize with JSON parser config', () => {
      const builder = new ExpressRestApiBuilder({
        ...config,
        jsonParser: { limit: '10mb' },
      });
      expect(builder).toBeDefined();
    });

    test('should register WebSocket routes', () => {
      const builder = new ExpressRestApiBuilder({
        ...config,
        loadSession: async () => ({ userId: 1 }),
        services: [['WS', '/ws/test', class { async run() { return {}; } }]],
      });
      builder.build();
      expect(builder).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith('WebSocket route registered: /api/ws/test');
    });
  });

  describe('routes registration', () => {
    test('should register authenticated routes', () => {
      class TestHandler {
        async run() {
          return { message: 'success' };
        }
      }

      const server = new ExpressRestApiBuilder({
        ...config,
        loadSession: async () => ({ userId: 1 }),
        services: [['GET', '/test', TestHandler]],
      });
      server.build();

      expect(mockLogger.info).toHaveBeenCalledWith('Authenticated routes registered: 1');
    });

    test('should register multiple routes', () => {
      class Handler1 {
        async run() {
          return { data: 1 };
        }
      }
      class Handler2 {
        async run() {
          return { data: 2 };
        }
      }

      const server = new ExpressRestApiBuilder({
        ...config,
        loadSession: async () => ({ userId: 1 }),
        services: [
          ['GET', '/test1', Handler1],
          ['POST', '/test2', Handler2],
        ],
      });
      server.build();

      expect(mockLogger.info).toHaveBeenCalledWith('Authenticated routes registered: 2');
    });

    test('should register unauthenticated routes', () => {
      class LoginHandler {
        async run() {
          return { token: 'abc123' };
        }
      }

      const server = new ExpressRestApiBuilder({
        ...config,
        unauthenticatedServices: [['POST', '/login', LoginHandler]],
      });
      server.build();

      expect(mockLogger.info).toHaveBeenCalledWith('Unauthenticated routes registered: 1');
    });

    test('should use custom unauthenticatedApiBaseUrl', () => {
      class HealthHandler {
        async run() {
          return { status: 'ok' };
        }
      }

      const server = new ExpressRestApiBuilder({
        ...config,
        unauthenticatedApiBaseUrl: '/public',
        unauthenticatedServices: [['GET', '/health', HealthHandler]],
      });
      server.build();

      expect(mockLogger.info).toHaveBeenCalledWith('Unauthenticated routes registered: 1');
    });

    test('should register WebSocket route in services array', () => {
      class ChatHandler {
        async run() {
          return { success: true };
        }
      }

      const server = new ExpressRestApiBuilder({
        ...config,
        loadSession: async () => ({ userId: 1 }),
        services: [['WS', '/ws/chat/:roomId', ChatHandler]],
      });
      server.build();

      expect(mockLogger.info).toHaveBeenCalledWith('WebSocket route registered: /api/ws/chat/:roomId');
    });

    test('should register HTTP and WebSocket routes together', () => {
      class ChatHandler {
        async run() {
          return { success: true };
        }
      }
      class UsersHandler {
        async run() {
          return { users: [] };
        }
      }

      const server = new ExpressRestApiBuilder({
        ...config,
        loadSession: async () => ({ userId: 1 }),
        services: [
          ['GET', '/users', UsersHandler],
          ['WS', '/ws/chat', ChatHandler],
        ],
      });
      server.build();

      expect(mockLogger.info).toHaveBeenCalledWith('Authenticated routes registered: 2');
    });
  });

  describe('getApp', () => {
    test('should return Express app', () => {
      const builder = new ExpressRestApiBuilder(config);
      const app = builder.getApp();

      expect(app).toBeDefined();
      expect(typeof app).toBe('function');
    });
  });

  describe('app.listen', () => {
    test('should be able to call listen on returned app', () => {
      const builder = new ExpressRestApiBuilder(config);
      const app = builder.getApp();

      expect(typeof app.listen).toBe('function');
    });
  });

  describe('build', () => {
    test('should throw if build() called twice', () => {
      const builder = new ExpressRestApiBuilder({
        ...config,
        loadSession: async () => ({ userId: 1 }),
        services: [['GET', '/test', class { async run() { return {}; } }]],
      });

      builder.build();

      expect(() => builder.build()).toThrow('build() can only be called once');
    });

    test('should allow getApp() after build()', () => {
      const builder = new ExpressRestApiBuilder(config);
      builder.build();

      expect(builder.getApp()).toBeDefined();
    });
  });

  describe('route validation', () => {
    test('should throw on invalid HTTP method', () => {
      expect(
        () =>
          new ExpressRestApiBuilder({
            ...config,
            loadSession: async () => ({ userId: 1 }),
            services: [['INVALID', '/test', class { async run() { return {}; } }] as any],
          })
      ).toThrow(/Invalid HTTP method "INVALID"/);
    });

    test('should throw on lowercase HTTP method', () => {
      expect(
        () =>
          new ExpressRestApiBuilder({
            ...config,
            loadSession: async () => ({ userId: 1 }),
            services: [['get', '/test', class { async run() { return {}; } }] as any],
          })
      ).toThrow(/Invalid HTTP method "get"/);
    });

    test('should accept all valid HTTP methods', () => {
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'WS'] as const;

      for (const method of validMethods) {
        expect(
          () =>
            new ExpressRestApiBuilder({
              ...config,
              loadSession: async () => ({ userId: 1 }),
              services: [[method, '/test', class { async run() { return {}; } }]],
            })
        ).not.toThrow();
      }
    });

    test('should throw on non-string path', () => {
      expect(
        () =>
          new ExpressRestApiBuilder({
            ...config,
            loadSession: async () => ({ userId: 1 }),
            services: [['GET', 123, class { async run() { return {}; } }] as any],
          })
      ).toThrow(/Path must be a string starting with "\/"/);
    });

    test('should throw on path not starting with /', () => {
      expect(
        () =>
          new ExpressRestApiBuilder({
            ...config,
            loadSession: async () => ({ userId: 1 }),
            services: [['GET', 'no-slash', class { async run() { return {}; } }]],
          })
      ).toThrow(/Path must be a string starting with "\/", got: "no-slash"/);
    });

    test('should throw on null path', () => {
      expect(
        () =>
          new ExpressRestApiBuilder({
            ...config,
            loadSession: async () => ({ userId: 1 }),
            services: [['GET', null, class { async run() { return {}; } }] as any],
          })
      ).toThrow(/Path must be a string starting with "\/"/);
    });

    test('should throw on non-function ServiceClass', () => {
      expect(
        () =>
          new ExpressRestApiBuilder({
            ...config,
            loadSession: async () => ({ userId: 1 }),
            services: [['GET', '/test', 'not-a-class'] as any],
          })
      ).toThrow(/ServiceClass must be a class\/constructor function, got string/);
    });

    test('should throw on null ServiceClass', () => {
      expect(
        () =>
          new ExpressRestApiBuilder({
            ...config,
            loadSession: async () => ({ userId: 1 }),
            services: [['GET', '/test', null] as any],
          })
      ).toThrow(/ServiceClass must be a class\/constructor function, got object/);
    });

    test('should throw on object instead of ServiceClass', () => {
      expect(
        () =>
          new ExpressRestApiBuilder({
            ...config,
            loadSession: async () => ({ userId: 1 }),
            services: [['GET', '/test', { run: () => {} }] as any],
          })
      ).toThrow(/ServiceClass must be a class\/constructor function, got object/);
    });

    test('should throw on non-array route definition', () => {
      expect(
        () =>
          new ExpressRestApiBuilder({
            ...config,
            loadSession: async () => ({ userId: 1 }),
            services: [{ method: 'GET', path: '/test' } as any],
          })
      ).toThrow(/Route must be a tuple of \[method, path, ServiceClass\]/);
    });

    test('should throw on route tuple with wrong length', () => {
      expect(
        () =>
          new ExpressRestApiBuilder({
            ...config,
            loadSession: async () => ({ userId: 1 }),
            services: [['GET', '/test'] as any],
          })
      ).toThrow(/Route must be a tuple of \[method, path, ServiceClass\]/);
    });

    test('should include array name and index in error message', () => {
      expect(
        () =>
          new ExpressRestApiBuilder({
            ...config,
            loadSession: async () => ({ userId: 1 }),
            services: [
              ['GET', '/test1', class { async run() { return {}; } }],
              ['INVALID', '/test2', class { async run() { return {}; } }] as any,
            ],
          })
      ).toThrow(/services\[1\]: Invalid HTTP method/);
    });

    test('should validate unauthenticatedServices array', () => {
      expect(
        () =>
          new ExpressRestApiBuilder({
            ...config,
            unauthenticatedServices: [['INVALID', '/test', class { async run() { return {}; } }] as any],
          })
      ).toThrow(/unauthenticatedServices\[0\]: Invalid HTTP method/);
    });
  });

  describe('config function validation', () => {
    test('should throw on non-function loadSession', () => {
      expect(
        () =>
          new ExpressRestApiBuilder({
            ...config,
            loadSession: 'not-a-function' as any,
            services: [['GET', '/test', class { async run() { return {}; } }]],
          })
      ).toThrow(/loadSession must be a function, got string/);
    });

    test('should throw on non-function runService', () => {
      expect(
        () =>
          new ExpressRestApiBuilder({
            runService: 'not-a-function' as any,
          })
      ).toThrow(/runService must be a function, got string/);
    });

    test('should throw on non-function createService', () => {
      expect(
        () =>
          new ExpressRestApiBuilder({
            createService: {} as any,
          })
      ).toThrow(/createService must be a function, got object/);
    });

    test('should throw on non-function mapError', () => {
      expect(
        () =>
          new ExpressRestApiBuilder({
            createService: jest.fn(() => ({ run: async () => ({}) })),
            mapError: 'not-a-function' as any,
          })
      ).toThrow(/mapError must be a function, got string/);
    });

    test('should throw on non-function extractInput', () => {
      expect(
        () =>
          new ExpressRestApiBuilder({
            createService: jest.fn(() => ({ run: async () => ({}) })),
            extractInput: [] as any,
          })
      ).toThrow(/extractInput must be a function, got object/);
    });

    test('should accept undefined for optional functions', () => {
      expect(
        () =>
          new ExpressRestApiBuilder({
            ...config,
            loadSession: undefined,
            mapError: undefined,
            extractInput: undefined,
          })
      ).not.toThrow();
    });
  });
});
