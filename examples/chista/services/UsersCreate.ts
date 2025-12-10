import { Base } from './Base';

const validation = {
  name: ['required', { min_length: 1 }],
  email: ['required', 'email'],
} as const;

interface CreateUserInput {
  name: string;
  email: string;
}

interface User {
  id: number;
  name: string;
  email: string;
}

export class UsersCreate extends Base<CreateUserInput, User> {
  static validation = validation;

  async execute(data: CreateUserInput): Promise<User> {
    const id = this.db.size + 1;
    const user = { id, name: data.name, email: data.email };

    this.db.set(id, user);

    return user;
  }
}
