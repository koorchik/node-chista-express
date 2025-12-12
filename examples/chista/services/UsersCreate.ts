import LIVR from 'livr';
import { Base } from './Base';

const validation = {
  name: ['required', { min_length: 1 }],
  email: ['required', 'email'],
} as const;

type UsersCreateParams = LIVR.InferFromSchema<typeof validation>;

type UsersCreateResult = {
  id: number;
  name: string;
  email: string;
};

export class UsersCreate extends Base<UsersCreateParams, UsersCreateResult> {
  static validation = validation;

  async execute(data: UsersCreateParams): Promise<UsersCreateResult> {
    const id = this.db.size + 1;
    const user = { id, name: data.name, email: data.email };

    this.db.set(id, user);

    return {
      id: user.id,
      name: user.name,
      email: user.email
    };
  }
}
