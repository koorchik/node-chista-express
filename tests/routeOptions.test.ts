import request from 'supertest';
import { ExpressRestApiBuilder, RestApiError } from '../src';
import type { RequestHandler } from 'express';

describe('Route Options', () => {
  describe('per-route middlewares', () => {
    test('should execute middleware before service', async () => {
      const executionOrder: string[] = [];

      const trackingMiddleware: RequestHandler = (_req, _res, next) => {
        executionOrder.push('middleware');
        next();
      };

      class TestService {
        async run() {
          executionOrder.push('service');
          return { ok: true };
        }
      }

      const builder = new ExpressRestApiBuilder({
        createService: (Service) => new Service(),
        unauthenticatedServices: [
          ['GET', '/test', TestService, { middlewares: [trackingMiddleware] }],
        ],
      });
      builder.build();

      const response = await request(builder.getApp())
        .get('/api/public/test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(executionOrder).toEqual(['middleware', 'service']);
    });

    test('should execute multiple middlewares in order', async () => {
      const executionOrder: string[] = [];

      const middleware1: RequestHandler = (_req, _res, next) => {
        executionOrder.push('middleware1');
        next();
      };

      const middleware2: RequestHandler = (_req, _res, next) => {
        executionOrder.push('middleware2');
        next();
      };

      class TestService {
        async run() {
          executionOrder.push('service');
          return { ok: true };
        }
      }

      const builder = new ExpressRestApiBuilder({
        createService: (Service) => new Service(),
        unauthenticatedServices: [
          ['GET', '/test', TestService, { middlewares: [middleware1, middleware2] }],
        ],
      });
      builder.build();

      await request(builder.getApp()).get('/api/public/test').expect(200);

      expect(executionOrder).toEqual(['middleware1', 'middleware2', 'service']);
    });

    test('should attach data to request in middleware', async () => {
      const attachDataMiddleware: RequestHandler = (req, _res, next) => {
        (req as any).customData = { value: 42 };
        next();
      };

      class TestService {
        async run(input: any) {
          return { customData: input.customData };
        }
      }

      const builder = new ExpressRestApiBuilder({
        createService: (Service) => new Service(),
        extractInput: (ctx) => ({
          customData: (ctx.request as any).customData,
        }),
        unauthenticatedServices: [
          ['GET', '/test', TestService, { middlewares: [attachDataMiddleware] }],
        ],
      });
      builder.build();

      const response = await request(builder.getApp())
        .get('/api/public/test')
        .expect(200);

      expect(response.body.result.customData).toEqual({ value: 42 });
    });

    test('should work with file upload simulation', async () => {
      // Simulate multer-like middleware
      const fakeMulterMiddleware: RequestHandler = (req, _res, next) => {
        (req as any).file = {
          fieldname: 'avatar',
          originalname: 'test.jpg',
          mimetype: 'image/jpeg',
          size: 1024,
        };
        next();
      };

      class UploadService {
        async run(input: any) {
          return {
            filename: input.file?.originalname,
            size: input.file?.size,
          };
        }
      }

      const builder = new ExpressRestApiBuilder({
        createService: (Service) => new Service(),
        unauthenticatedServices: [
          ['POST', '/upload', UploadService, { middlewares: [fakeMulterMiddleware] }],
        ],
      });
      builder.build();

      const response = await request(builder.getApp())
        .post('/api/public/upload')
        .expect(200);

      expect(response.body.result).toEqual({
        filename: 'test.jpg',
        size: 1024,
      });
    });

    test('route without options should still work', async () => {
      class TestService {
        async run() {
          return { ok: true };
        }
      }

      const builder = new ExpressRestApiBuilder({
        createService: (Service) => new Service(),
        unauthenticatedServices: [['GET', '/test', TestService]],
      });
      builder.build();

      const response = await request(builder.getApp())
        .get('/api/public/test')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('per-route runService', () => {
    test('should use route-level runService instead of global createService', async () => {
      class GlobalService {
        async run() {
          return { source: 'global' };
        }
      }

      class RouteService {
        async run(_input: any) {
          return { source: 'route' };
        }
      }

      const builder = new ExpressRestApiBuilder({
        createService: (Service) => new Service(),
        unauthenticatedServices: [
          ['GET', '/global', GlobalService],
          [
            'GET',
            '/route',
            RouteService,
            {
              runService: async (Service, context) => {
                const service = new Service();
                return service.run({ request: context.request });
              },
            },
          ],
        ],
      });
      builder.build();

      const globalResponse = await request(builder.getApp())
        .get('/api/public/global')
        .expect(200);
      expect(globalResponse.body.result.source).toBe('global');

      const routeResponse = await request(builder.getApp())
        .get('/api/public/route')
        .expect(200);
      expect(routeResponse.body.result.source).toBe('route');
    });

    test('should pass raw request for streaming scenarios', async () => {
      class StreamService {
        async run(input: { rawRequest: any }) {
          return {
            hasRawRequest: !!input.rawRequest,
            method: input.rawRequest?.method,
          };
        }
      }

      const builder = new ExpressRestApiBuilder({
        createService: (Service) => new Service(),
        unauthenticatedServices: [
          [
            'POST',
            '/stream',
            StreamService,
            {
              runService: async (Service, context) => {
                const service = new Service();
                return service.run({ rawRequest: context.request });
              },
            },
          ],
        ],
      });
      builder.build();

      const response = await request(builder.getApp())
        .post('/api/public/stream')
        .expect(200);

      expect(response.body.result.hasRawRequest).toBe(true);
      expect(response.body.result.method).toBe('POST');
    });
  });

  describe('per-route createService', () => {
    test('should use route-level createService', async () => {
      class TestService {
        constructor(private deps: { injected: string }) {}
        async run() {
          return { injected: this.deps.injected };
        }
      }

      const builder = new ExpressRestApiBuilder({
        createService: (Service) => new Service({ injected: 'global' }),
        unauthenticatedServices: [
          ['GET', '/global', TestService],
          [
            'GET',
            '/route',
            TestService,
            {
              createService: (Service) => new Service({ injected: 'route-level' }),
            },
          ],
        ],
      });
      builder.build();

      const globalResponse = await request(builder.getApp())
        .get('/api/public/global')
        .expect(200);
      expect(globalResponse.body.result.injected).toBe('global');

      const routeResponse = await request(builder.getApp())
        .get('/api/public/route')
        .expect(200);
      expect(routeResponse.body.result.injected).toBe('route-level');
    });
  });

  describe('per-route extractInput', () => {
    test('should use route-level extractInput', async () => {
      class TestService {
        async run(input: any) {
          return { input };
        }
      }

      const builder = new ExpressRestApiBuilder({
        createService: (Service) => new Service(),
        extractInput: () => ({ source: 'global' }),
        unauthenticatedServices: [
          ['GET', '/global', TestService],
          [
            'GET',
            '/route',
            TestService,
            {
              extractInput: () => ({ source: 'route-level', custom: true }),
            },
          ],
        ],
      });
      builder.build();

      const globalResponse = await request(builder.getApp())
        .get('/api/public/global')
        .expect(200);
      expect(globalResponse.body.result.input.source).toBe('global');

      const routeResponse = await request(builder.getApp())
        .get('/api/public/route')
        .expect(200);
      expect(routeResponse.body.result.input.source).toBe('route-level');
      expect(routeResponse.body.result.input.custom).toBe(true);
    });
  });

  describe('per-route mapError', () => {
    test('should use route-level mapError', async () => {
      class CustomError extends Error {
        constructor(public code: string) {
          super('Custom error');
        }
      }

      class FailingService {
        async run() {
          throw new CustomError('ROUTE_ERROR');
        }
      }

      const builder = new ExpressRestApiBuilder({
        createService: (Service) => new Service(),
        mapError: (error) => {
          if (error instanceof CustomError) {
            return new RestApiError({ code: 'GLOBAL', message: error.message }, 400);
          }
          return undefined;
        },
        unauthenticatedServices: [
          ['GET', '/global', FailingService],
          [
            'GET',
            '/route',
            FailingService,
            {
              mapError: (error) => {
                if (error instanceof CustomError) {
                  return new RestApiError(
                    { code: error.code, message: 'Route-level error' },
                    422
                  );
                }
                return undefined;
              },
            },
          ],
        ],
      });
      builder.build();

      const globalResponse = await request(builder.getApp())
        .get('/api/public/global')
        .expect(400);
      expect(globalResponse.body.error.code).toBe('GLOBAL');

      const routeResponse = await request(builder.getApp())
        .get('/api/public/route')
        .expect(422);
      expect(routeResponse.body.error.code).toBe('ROUTE_ERROR');
      expect(routeResponse.body.error.message).toBe('Route-level error');
    });
  });

  describe('route validation with options', () => {
    test('should accept 4-tuple with valid options', () => {
      expect(() => {
        new ExpressRestApiBuilder({
          createService: (Service) => new Service(),
          unauthenticatedServices: [
            ['GET', '/test', class { async run() { return {}; } }, { middlewares: [] }],
          ],
        });
      }).not.toThrow();
    });

    test('should throw on non-object options', () => {
      expect(() => {
        new ExpressRestApiBuilder({
          createService: (Service) => new Service(),
          unauthenticatedServices: [
            ['GET', '/test', class { async run() { return {}; } }, 'invalid' as any],
          ],
        });
      }).toThrow(/Route options must be an object/);
    });

    test('should throw on non-array middlewares', () => {
      expect(() => {
        new ExpressRestApiBuilder({
          createService: (Service) => new Service(),
          unauthenticatedServices: [
            ['GET', '/test', class { async run() { return {}; } }, { middlewares: 'invalid' as any }],
          ],
        });
      }).toThrow(/options\.middlewares must be an array/);
    });

    test('should throw on non-function runService in options', () => {
      expect(() => {
        new ExpressRestApiBuilder({
          createService: (Service) => new Service(),
          unauthenticatedServices: [
            ['GET', '/test', class { async run() { return {}; } }, { runService: 'invalid' as any }],
          ],
        });
      }).toThrow(/options\.runService must be a function/);
    });
  });

  describe('multipart/form-data handling', () => {
    test('should skip JSON parsing for multipart requests', async () => {
      class TestService {
        async run(input: any) {
          return { hasBody: !!input.body, body: input.body };
        }
      }

      const builder = new ExpressRestApiBuilder({
        createService: (Service) => new Service(),
        extractInput: (ctx) => ({ body: ctx.request.body }),
        unauthenticatedServices: [['POST', '/upload', TestService]],
      });
      builder.build();

      // This would normally fail JSON parsing, but should pass through
      const response = await request(builder.getApp())
        .post('/api/public/upload')
        .set('Content-Type', 'multipart/form-data; boundary=---boundary')
        .send('---boundary\r\nContent-Disposition: form-data; name="file"\r\n\r\ntest\r\n---boundary--')
        .expect(200);

      // Body should be empty/undefined since we skipped JSON parsing
      // and no multipart parser is installed
      expect(response.body.success).toBe(true);
    });
  });
});
