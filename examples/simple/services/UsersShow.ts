import { RestApiError, type Service } from '../../../src';

type UsersShowDependencies = {
  db: Map<number, { id: number; name: string; email: string }>;
};

type UsersShowParams = {
  id: string;
};

type UsersShowResult = {
  id: number;
  name: string;
  email: string;
};

export class UsersShow implements Service<UsersShowParams, UsersShowResult> {
  constructor(private deps: UsersShowDependencies) {}

  async run(input: UsersShowParams): Promise<UsersShowResult> {
    const id = parseInt(input.id, 10);
    const user = this.deps.db.get(id);

    if (!user) {
      throw new RestApiError({ code: 'NOT_FOUND', message: 'User not found' }, 404);
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email
    };
  }
}
