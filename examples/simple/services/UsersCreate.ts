import { RestApiError, type Service } from '../../../src';

interface Dependencies {
  db: Map<number, { id: number; name: string; email: string }>;
}

interface Input {
  name: string;
  email: string;
}

export class UsersCreate implements Service<Input> {
  constructor(private deps: Dependencies) {}

  async run(input: Input) {
    if (!input.name || !input.email) {
      throw new RestApiError(
        {
          code: 'VALIDATION_ERROR',
          message: 'Name and email are required',
          fields: {
            name: !input.name ? 'Required' : undefined,
            email: !input.email ? 'Required' : undefined,
          },
        },
        400
      );
    }

    const id = this.deps.db.size + 1;
    const user = { id, name: input.name, email: input.email };

    this.deps.db.set(id, user);

    return user;
  }
}
