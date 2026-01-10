import express, { Application, Request, Response, NextFunction, Router, RequestHandler } from 'express';
import expressWs from 'express-ws';
import { RestApiError } from './RestApiError.js';
import { createJsonParserMiddleware } from './middleware.js';
import type {
  RestApiServerConfig,
  RouteDefinition,
  RouteOptions,
  Logger,
  RequestContext,
  Session,
  ServiceClass,
} from './types.js';

export class ExpressRestApiBuilder {
  #app: Application;
  #config: RestApiServerConfig;
  #logger?: Logger;
  #built = false;

  constructor(config: RestApiServerConfig) {
    this.#validateConfig(config);
    this.#config = config;
    this.#logger = config.logger;

    this.#app = express();
    expressWs(this.#app);
    this.#initializeMiddleware();
  }

  static readonly #VALID_HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'WS'] as const;

  #validateConfig(config: RestApiServerConfig): void {
    // Validate that either runService or createService is provided
    if (!config.runService && !config.createService) {
      throw new Error('Either runService or createService is required');
    }
    if (config.services && config.services.length > 0 && !config.loadSession) {
      throw new Error('loadSession is required when services are defined');
    }

    // Validate callback functions are actually functions
    this.#validateFunction(config.runService, 'runService');
    this.#validateFunction(config.createService, 'createService');
    this.#validateFunction(config.loadSession, 'loadSession');
    this.#validateFunction(config.mapError, 'mapError');
    this.#validateFunction(config.extractInput, 'extractInput');

    // Validate route definitions
    if (config.services) {
      this.#validateRoutes(config.services, 'services');
    }
    if (config.unauthenticatedServices) {
      this.#validateRoutes(config.unauthenticatedServices, 'unauthenticatedServices');
    }
  }

  #validateFunction(value: unknown, name: string): void {
    if (value !== undefined && typeof value !== 'function') {
      throw new Error(`${name} must be a function, got ${typeof value}`);
    }
  }

  #validateRoutes(routes: unknown[], arrayName: string): void {
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];

      if (!Array.isArray(route) || route.length < 3 || route.length > 4) {
        throw new Error(
          `${arrayName}[${i}]: Route must be [method, path, ServiceClass] or [method, path, ServiceClass, options]`
        );
      }

      const [method, path, ServiceClass, options] = route;

      // Validate HTTP method
      if (
        typeof method !== 'string' ||
        !(ExpressRestApiBuilder.#VALID_HTTP_METHODS as readonly string[]).includes(method)
      ) {
        throw new Error(
          `${arrayName}[${i}]: Invalid HTTP method "${method}". ` +
            `Must be one of: ${ExpressRestApiBuilder.#VALID_HTTP_METHODS.join(', ')}`
        );
      }

      // Validate path
      if (typeof path !== 'string' || !path.startsWith('/')) {
        throw new Error(
          `${arrayName}[${i}]: Path must be a string starting with "/", got: ${typeof path === 'string' ? `"${path}"` : typeof path}`
        );
      }

      // Validate ServiceClass is a constructor function
      if (typeof ServiceClass !== 'function') {
        throw new Error(
          `${arrayName}[${i}]: ServiceClass must be a class/constructor function, got ${typeof ServiceClass}`
        );
      }

      // Validate options if present
      if (options !== undefined) {
        if (typeof options !== 'object' || options === null) {
          throw new Error(`${arrayName}[${i}]: Route options must be an object`);
        }
        if (options.middlewares !== undefined && !Array.isArray(options.middlewares)) {
          throw new Error(`${arrayName}[${i}]: options.middlewares must be an array`);
        }
        // Validate per-route callbacks
        this.#validateFunction(options.runService, `${arrayName}[${i}].options.runService`);
        this.#validateFunction(options.createService, `${arrayName}[${i}].options.createService`);
        this.#validateFunction(options.mapError, `${arrayName}[${i}].options.mapError`);
        this.#validateFunction(options.extractInput, `${arrayName}[${i}].options.extractInput`);
      }
    }
  }

  #defaultExtractInput(context: RequestContext): Record<string, any> {
    const { request, ws } = context;
    return {
      ...request.query,
      ...request.params,
      ...request.body,
      ws,
      userAgent: request.headers['user-agent'],
      clientIp: request.socket?.remoteAddress,
      // Include file(s) if present (from multer or similar middleware)
      file: (request as any).file,
      files: (request as any).files,
    };
  }

  #initializeMiddleware(): void {
    this.#app.use(createJsonParserMiddleware(
      this.#config.jsonParser, this.#logger
    ));
  }

  build(): void {
    if (this.#built) {
      throw new Error('build() can only be called once');
    }
    this.#built = true;
    this.#registerRoutes();
    this.#app.use(this.#errorHandlerMiddleware.bind(this));
  }

  #registerRoutes(): void {
    const apiBaseUrl = this.#config.apiBaseUrl || '/api';
    const unauthenticatedApiBaseUrl = this.#config.unauthenticatedApiBaseUrl ?? `${apiBaseUrl}/public`;

    if (this.#config.unauthenticatedServices && this.#config.unauthenticatedServices.length > 0) {
      const unauthenticatedRouter = express.Router();
      this.#addRoutesToRouter(unauthenticatedRouter, this.#config.unauthenticatedServices, unauthenticatedApiBaseUrl);
      this.#app.use(unauthenticatedApiBaseUrl, unauthenticatedRouter);

      const httpRoutes = this.#config.unauthenticatedServices.filter(([method]) => method !== 'WS');
      const wsRoutes = this.#config.unauthenticatedServices.filter(([method]) => method === 'WS');

      this.#logger?.info(`Unauthenticated routes registered: ${httpRoutes.length + wsRoutes.length}`);
    }

    if (this.#config.services && this.#config.services.length > 0) {
      const authenticatedRouter = express.Router();

      authenticatedRouter.use(async (req: Request, res: Response, next: NextFunction) => {
        try {
          if (this.#config.loadSession) {
            const session = await this.#config.loadSession(req);
            (req as any).session = session;
          }
          next();
        } catch (error) {
          if (this.#config.mapError) {
            const mapped = this.#config.mapError(error);
            if (mapped) {
              this.#handleError(mapped, res);
              return;
            }
          }
          this.#handleError(error, res);
        }
      });

      this.#addRoutesToRouter(authenticatedRouter, this.#config.services, apiBaseUrl);
      this.#app.use(apiBaseUrl, authenticatedRouter);

      const httpRoutes = this.#config.services.filter(([method]) => method !== 'WS');
      const wsRoutes = this.#config.services.filter(([method]) => method === 'WS');

      this.#logger?.info(`Authenticated routes registered: ${httpRoutes.length + wsRoutes.length}`);
    }

  }

  #addRoutesToRouter(router: Router, routes: RouteDefinition[], basePath: string = ''): void {
    for (const route of routes) {
      const [method, path, ServiceClass, options] = route;

      if (method === 'WS') {
        this.#registerWebSocketRoute(route, basePath);
        continue;
      }

      const routeHandler = async (req: Request, res: Response, _next: NextFunction) => {
        try {
          const result = await this.#executeService({
            ServiceClass,
            req,
            session: (req as any).session,
            options,
          });

          res.json({ success: true, result });
        } catch (error) {
          this.#handleError(error, res);
        }
      };

      // Collect middlewares for this route
      const middlewares: RequestHandler[] = options?.middlewares ?? [];

      router[method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch'](
        path,
        ...middlewares,
        routeHandler
      );
    }
  }

  #registerWebSocketRoute([_method, path, ServiceClass]: RouteDefinition, basePath: string = ''): void {
    const fullPath = basePath + path;
    (this.#app as any).ws(fullPath, async (ws: any, req: Request) => {
      try {
        let session;
        if (this.#config.loadSession) {
          session = await this.#config.loadSession(req);
          (req as any).session = session;
        }

        await this.#executeService({
          ServiceClass,
          req,
          session,
          ws,
        });
      } catch (error) {
        if (this.#config.mapError) {
          const mapped = this.#config.mapError(error);
          if (mapped) {
            ws.close();
            return;
          }
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.#logger?.error(`WebSocket service error at ${fullPath}: ${errorMessage}`);
        ws.close();
      }
    });

    this.#logger?.info(`WebSocket route registered: ${fullPath}`);
  }

  getApp(): Application {
    return this.#app;
  }

  async #executeService({
    ServiceClass,
    req,
    session,
    ws,
    options,
  }: {
    ServiceClass: ServiceClass;
    req: Request;
    session?: Session;
    ws?: any;
    options?: RouteOptions;
  }): Promise<any> {
    const context: RequestContext = {
      request: req,
      session,
      ws,
    };

    // Route-level runService takes precedence over global
    const runService = options?.runService ?? this.#config.runService;
    if (runService) {
      return await runService(ServiceClass, context);
    }

    // Route-level createService takes precedence over global
    const createService = options?.createService ?? this.#config.createService!;
    const service = createService(ServiceClass, context);

    // Route-level extractInput takes precedence over global
    const extractInput = options?.extractInput ?? this.#config.extractInput ?? this.#defaultExtractInput;
    const input = extractInput(context);

    try {
      return await service.run(input);
    } catch (error) {
      // Route-level mapError takes precedence over global
      const mapError = options?.mapError ?? this.#config.mapError;
      if (mapError) {
        const mapped = mapError(error);
        if (mapped) {
          throw mapped;
        }
      }
      throw error;
    }
  }

  #handleError(error: unknown, res: Response): void {
    if (error instanceof RestApiError) {
      if (error.httpCode >= 500) {
        this.#logger?.error(`Request error: ${JSON.stringify(error.data)}`);
      }
      res.status(error.httpCode).json({
        success: false,
        error: error.data,
      });
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.#logger?.error(`Request error: ${errorMessage}`);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      });
    }
  }

  #errorHandlerMiddleware(
    error: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
  ): void {
    this.#handleError(error, res);
  }
}
