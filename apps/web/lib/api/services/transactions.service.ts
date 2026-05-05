import apiClient from '../core/client';
import { BackendTransaction } from '../types/backend';
import { mapTransaction } from '../mappers/account.mapper';

export const transactionsApi = {
  getAll: async (userId?: string, accountId?: string) => {
    const params: Record<string, string> = {};
    if (userId) params.user_id = userId;
    if (accountId) params.account_id = accountId;

    const response = await apiClient.get<{ transactions: BackendTransaction[] }>(
      '/api/transactions',
      { params }
    );
    return response.data.transactions.map(mapTransaction);
  },
};
