import apiClient from '../core/client';
import { BackendAccount } from '../types/backend';
import { mapAccount } from '../mappers/account.mapper';

export const accountsApi = {
  getAll: async (userId?: string) => {
    const params = userId ? { user_id: userId } : {};
    const response = await apiClient.get<{ accounts: BackendAccount[] }>(
      '/api/accounts',
      { params }
    );
    return response.data.accounts.map(mapAccount);
  },

  getById: async (accountId: string) => {
    const response = await apiClient.get<{ account: BackendAccount | null }>(
      `/api/accounts/${accountId}`
    );
    return response.data.account ? mapAccount(response.data.account) : null;
  },
};
