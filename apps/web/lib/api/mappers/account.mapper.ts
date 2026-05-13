import type { BackendAccount, BackendTransaction } from '../types/backend';
import type { Account, Transaction } from '../types/domain';

export const mapAccount = (account: BackendAccount): Account => ({
  account_id: account.accountId,
  name: account.name,
  mask: account.mask,
  type: 'depository' as const,
  subtype: account.subtype,
  balance: {
    available: account.balances.available ?? null,
    current: account.balances.current ?? null,
    limit: null,
  },
});

export const mapTransaction = (txn: BackendTransaction): Transaction => ({
  transaction_id: txn.transactionId,
  account_id: txn.accountId,
  amount: txn.amountMinor / 100,
  date: txn.date,
  name: txn.name,
  category: [] as string[],
  pending: txn.pending,
});
