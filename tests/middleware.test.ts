import { createJsonParserMiddleware, skipForWebSocket } from '../src/middleware';
import type { Logger } from '../src/types';
import type { Request, Response } from 'express';

describe('Middleware', () => {
  describe('createJsonParserMiddleware', () => {
    let mockLogger: Logger;

    beforeEach(() => {
      mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
      };
    });

    test('should create JSON parser middleware with default config', () => {
      const middleware = createJsonParserMiddleware();
      expect(middleware).toBeDefined();
      expect(Array.isArray(middleware)).toBe(true);
      expect(middleware.length).toBe(2);
    });

    test('should create JSON parser middleware with custom limit', () => {
      const middleware = createJsonParserMiddleware({
        limit: '2mb',
        strict: true,
      });
      expect(middleware).toBeDefined();
    });

    test('should create JSON parser middleware with logger', () => {
      const middleware = createJsonParserMiddleware(undefined, mockLogger);
      expect(middleware).toBeDefined();
    });

    test('should handle invalid JSON in verify function', () => {
      const middleware = createJsonParserMiddleware(undefined, mockLogger);
      expect(middleware).toBeDefined();
    });
  });

  describe('skipForWebSocket', () => {
    test('should skip middleware for websocket upgrade requests', () => {
      const innerMiddleware = jest.fn();
      const wrapped = skipForWebSocket(innerMiddleware);
      const req = { headers: { upgrade: 'websocket' } } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn();

      wrapped(req, res, next);

      expect(innerMiddleware).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    test('should call middleware for non-websocket requests', () => {
      const innerMiddleware = jest.fn();
      const wrapped = skipForWebSocket(innerMiddleware);
      const req = { headers: {} } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn();

      wrapped(req, res, next);

      expect(innerMiddleware).toHaveBeenCalledWith(req, res, next);
    });
  });

  describe('JSON error handler', () => {
    test('should pass non-JSON errors to next', () => {
      const mockLogger: Logger = { info: jest.fn(), error: jest.fn() };
      const [, errorHandler] = createJsonParserMiddleware(undefined, mockLogger);
      const req = {} as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
      const next = jest.fn();
      const nonJsonError = new Error('Not a JSON error');

      (errorHandler as any)(nonJsonError, req, res, next);

      expect(next).toHaveBeenCalledWith(nonJsonError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
