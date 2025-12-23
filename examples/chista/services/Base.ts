import { ServiceBase } from 'chista';

// Database type for this example
export type Database = Map<number, { id: number; name: string; email: string }>;

export interface Dependencies {
  db: Database;
}

/**
 * Project-specific base class that extends chista's ServiceBase.
 * Add your project-wide logic here (transactions, event publishing, etc.)
 */
export abstract class Base<TInput = unknown, TOutput = unknown> extends ServiceBase<TInput, TOutput> {
  protected db: Database;

  constructor(deps: Dependencies) {
    super();
    this.db = deps.db;
  }

  async checkPermissions(): Promise<boolean> {
    return true;
  }
}
