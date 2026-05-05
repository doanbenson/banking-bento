import { BackendAccount, BackendTransaction } from '../types/backend';

export const mapAccount = (account: BackendAccount) => ({
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

export const mapTransaction = (txn: BackendTransaction) => ({
  transaction_id: txn.transactionId,
  account_id: txn.accountId,
  amount: txn.amountMinor / 100,
  date: txn.date,
  name: txn.name,
  category: [] as string[],
  pending: txn.pending,
});
