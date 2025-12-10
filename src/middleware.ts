import express from 'express';
import type { RequestHandler, ErrorRequestHandler } from 'express';
import type { Logger } from './types';

export interface JsonParserConfig {
  limit?: string | number;
  strict?: boolean;
}

export function createJsonParserMiddleware(
  config?: JsonParserConfig,
  logger?: Logger
): (RequestHandler | ErrorRequestHandler)[] {
  const limit = config?.limit || '1mb';

  const jsonParser = express.json({
    limit,
    strict: config?.strict ?? true,
  });

  const jsonErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
    if (err instanceof SyntaxError && 'body' in err) {
      logger?.error(`Invalid JSON in request body: ${err.message}`);
      res.status(400).json({
        success: false,
        error: {
          code: 'BROKEN_JSON',
          message: 'Please verify your JSON',
        },
      });
      return;
    }
    next(err);
  };

  return [jsonParser, jsonErrorHandler];
}

export type JsonParserMiddleware = (RequestHandler | ErrorRequestHandler)[];

export function skipForWebSocket(middleware: RequestHandler): RequestHandler {
  return (req, res, next) => {
    if (req.headers.upgrade === 'websocket') {
      return next();
    }
    return middleware(req, res, next);
  };
}
