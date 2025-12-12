import { Base } from './Base';

type UsersListResult = Array<{
  id: number;
  name: string;
  email: string;
}>;

export class UsersList extends Base<void, UsersListResult> {
  async execute(): Promise<UsersListResult> {
    return Array.from(this.db.values()).map(user => ({
      id: user.id,
      name: user.name,
      email: user.email
    }));
  }
}
