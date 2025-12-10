import { ServiceBase } from 'chista';

/**
 * Base class for services that don't need database access (e.g., health checks).
 */
export abstract class BaseSimple<TInput = unknown, TOutput = unknown> extends ServiceBase<TInput, TOutput> {
  abstract execute(data: TInput): Promise<TOutput>;

  async doRun(data: TInput): Promise<TOutput> {
    return this.execute(data);
  }

  async checkPermissions(): Promise<boolean> {
    return true;
  }
}
