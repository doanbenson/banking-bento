import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type BackendAccount = {
  accountId: string;
  name: string;
  mask?: string;
  subtype: string;
  balances: {
    available?: number;
    current?: number;
  };
};

type BackendTransaction = {
  transactionId: string;
  accountId: string;
  amountMinor: number;
  date: string;
  name: string;
  pending: boolean;
};

const unwrap = <T>(payload: ApiEnvelope<T>): T => {
  if (!payload.success || typeof payload.data === 'undefined') {
    throw new Error(payload.error?.message || 'API request failed');
  }

  return payload.data;
};

const mapAccount = (account: BackendAccount) => ({
  account_id: account.accountId,
  name: account.name,
  mask: account.mask,
  type: 'depository',
  subtype: account.subtype,
  balance: {
    available: account.balances.available ?? null,
    current: account.balances.current ?? null,
    limit: null
  }
});

const mapTransaction = (txn: BackendTransaction) => ({
  transaction_id: txn.transactionId,
  account_id: txn.accountId,
  amount: txn.amountMinor / 100,
  date: txn.date,
  name: txn.name,
  category: [] as string[],
  pending: txn.pending
});

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Plaid API
export const plaidApi = {
  createLinkToken: async (userId: string = 'user-sandbox') => {
    const response = await apiClient.post<ApiEnvelope<{ link_token: string }>>('/api/plaid/create-link-token', { user_id: userId });
    return unwrap(response.data);
  },

  create_sandbox_public_token: async (userId: string = 'user-sandbox') => {
    const response = await apiClient.post<ApiEnvelope<{ public_token: string }>>('/api/plaid/sandbox/public_token/create', { user_id: userId });
    return unwrap(response.data);
  },

  exchangePublicToken: async (publicToken: string, userId: string = 'user-sandbox') => {
    const response = await apiClient.post<ApiEnvelope<{ access_token: string; item_id: string }>>('/api/plaid/exchange-token', {
      public_token: publicToken,
      user_id: userId,
    });
    return unwrap(response.data);
  },

  syncTransactions: async (itemId: string) => {
    const response = await apiClient.post<ApiEnvelope<{ synced: boolean; item_id: string }>>(`/api/plaid/sync-transactions/${itemId}`);
    return unwrap(response.data);
  },
};

// Accounts API
export const accountsApi = {
  getAll: async (userId?: string) => {
    const params = userId ? { user_id: userId } : {};
    const response = await apiClient.get<ApiEnvelope<{ accounts: BackendAccount[] }>>('/api/accounts', { params });
    const data = unwrap(response.data);
    return data.accounts.map(mapAccount);
  },

  getById: async (accountId: string) => {
    const response = await apiClient.get<ApiEnvelope<{ account: BackendAccount | null }>>(`/api/accounts/${accountId}`);
    const data = unwrap(response.data);
    return data.account ? mapAccount(data.account) : null;
  },
};

// Transactions API
export const transactionsApi = {
  getAll: async (userId?: string, accountId?: string) => {
    const params: Record<string, string> = {};
    if (userId) params.user_id = userId;
    if (accountId) params.account_id = accountId;

    const response = await apiClient.get<ApiEnvelope<{ transactions: BackendTransaction[] }>>('/api/transactions', { params });
    const data = unwrap(response.data);
    return data.transactions.map(mapTransaction);
  },
};

export default apiClient;