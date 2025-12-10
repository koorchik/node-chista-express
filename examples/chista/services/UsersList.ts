import { Base } from './Base';

interface User {
  id: number;
  name: string;
  email: string;
}

export class UsersList extends Base<void, User[]> {
  async execute(): Promise<User[]> {
    return Array.from(this.db.values());
  }
}
