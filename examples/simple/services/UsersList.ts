import type { Service } from '../../../src';

interface Dependencies {
  db: Map<number, { id: number; name: string; email: string }>;
}

export class UsersList implements Service {
  constructor(private deps: Dependencies) {}

  async run() {
    return Array.from(this.deps.db.values());
  }
}
