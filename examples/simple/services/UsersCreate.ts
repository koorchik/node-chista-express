import { RestApiError, type Service } from '../../../src';

type UsersCreateDependencies = {
  db: Map<number, { id: number; name: string; email: string }>;
};

type UsersCreateParams = {
  name: string;
  email: string;
};

type UsersCreateResult = {
  id: number;
  name: string;
  email: string;
};

export class UsersCreate implements Service<UsersCreateParams, UsersCreateResult> {
  constructor(private deps: UsersCreateDependencies) {}

  async run(input: UsersCreateParams): Promise<UsersCreateResult> {
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

    return {
      id: user.id,
      name: user.name,
      email: user.email
    };
  }
}
