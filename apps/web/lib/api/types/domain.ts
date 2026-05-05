import { mapAccount, mapTransaction } from '../mappers/account.mapper';

export type Account = ReturnType<typeof mapAccount>;
export type Transaction = ReturnType<typeof mapTransaction>;
