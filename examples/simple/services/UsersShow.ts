import { RestApiError, type Service } from '../../../src';

interface Dependencies {
  db: Map<number, { id: number; name: string; email: string }>;
}

interface Input {
  id: string;
}

export class UsersShow implements Service<Input> {
  constructor(private deps: Dependencies) {}

  async run(input: Input) {
    const id = parseInt(input.id, 10);
    const user = this.deps.db.get(id);

    if (!user) {
      throw new RestApiError({ code: 'NOT_FOUND', message: 'User not found' }, 404);
    }

    return user;
  }
}
