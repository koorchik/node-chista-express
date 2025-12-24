import type { Request, RequestHandler } from 'express';
import type { RestApiError } from './RestApiError';

export interface Logger {
  info(message: string): void;
  error(message: string): void;
}

export interface Session {
  [key: string]: any;
}

export interface RequestContext {
  request: Request;
  session?: Session;
  ws?: any;
}

export interface Service<TInput = any, TOutput = any> {
  run(input: TInput): Promise<TOutput>;
}

export type ServiceClass = new (...args: any[]) => Service;

export type CreateService = (
  Service: ServiceClass,
  context: RequestContext
) => Service;

export type RunService = (
  Service: ServiceClass,
  context: RequestContext
) => Promise<any>;

export type ExtractInput = (context: RequestContext) => Record<string, any>;

export type MapError = (error: unknown) => RestApiError | undefined;

export type LoadSession = (request: Request) => Promise<Session>;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'WS';

export interface RouteOptions {
  middlewares?: RequestHandler[];

  // Per-route execution overrides (same as global config options)
  runService?: RunService;
  createService?: CreateService;
  mapError?: MapError;
  extractInput?: ExtractInput;
}

export type RouteDefinition =
  | [method: HttpMethod, path: string, service: ServiceClass]
  | [method: HttpMethod, path: string, service: ServiceClass, options: RouteOptions];

export interface RestApiServerConfig {
  apiBaseUrl?: string;
  unauthenticatedApiBaseUrl?: string;

  jsonParser?: {
    limit?: string | number;
    strict?: boolean;
  };

  logger?: Logger;

  // Option 1: Full control - provide complete runService
  runService?: RunService;

  // Option 2: Simplified - provide createService (and optionally mapError, extractInput)
  createService?: CreateService;
  mapError?: MapError;
  extractInput?: ExtractInput;

  services?: RouteDefinition[];
  unauthenticatedServices?: RouteDefinition[];
  loadSession?: LoadSession;
}
