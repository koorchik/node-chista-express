import LIVR from 'livr';
import { ServiceError } from 'chista';
import { Base } from './Base';

const validation = {
  id: ['required', 'positive_integer'],
} as const;

type UsersShowParams = LIVR.InferFromSchema<typeof validation>;

type UsersShowResult = {
  id: number;
  name: string;
  email: string;
};

export class UsersShow extends Base<UsersShowParams, UsersShowResult> {
  static validation = validation;

  async execute(data: UsersShowParams) {
    const user = this.db.get(data.id);

    if (!user) {
      throw new ServiceError({ code: 'NOT_FOUND', fields: { id: 'NOT_FOUND' } });
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email
    };
  }
}
