import type { Service } from '../../../src';

type UsersListDependencies = {
  db: Map<number, { id: number; name: string; email: string }>;
};

type UsersListResult = Array<{
  id: number;
  name: string;
  email: string;
}>;

export class UsersList implements Service<void, UsersListResult> {
  constructor(private deps: UsersListDependencies) {}

  async run() {
    return Array.from(this.deps.db.values()).map(user => ({
      id: user.id,
      name: user.name,
      email: user.email
    }));
  }
}
