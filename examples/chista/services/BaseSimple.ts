import { ServiceBase } from 'chista';

/**
 * Base class for services that don't need database access (e.g., health checks).
 */
export abstract class BaseSimple<TInput = unknown, TOutput = unknown> extends ServiceBase<TInput, TOutput> {
  async checkPermissions(): Promise<boolean> {
    return true;
  }
}
