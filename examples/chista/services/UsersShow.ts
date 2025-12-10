import { ServiceError } from 'chista';
import { Base } from './Base';

const validation = {
  id: ['required', 'positive_integer'],
} as const;

interface User {
  id: number;
  name: string;
  email: string;
}

export class UsersShow extends Base<{ id: number }, User> {
  static validation = validation;

  async execute(data: { id: number }): Promise<User> {
    const user = this.db.get(data.id);

    if (!user) {
      throw new ServiceError({ code: 'NOT_FOUND', fields: { id: 'NOT_FOUND' } });
    }

    return user;
  }
}
