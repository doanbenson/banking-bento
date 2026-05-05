import apiClient from '../core/client';

export const plaidApi = {
  createLinkToken: async (userId: string = 'user-sandbox') => {
    const response = await apiClient.post<{ link_token: string }>(
      '/api/plaid/create-link-token',
      { user_id: userId }
    );
    return response.data;
  },

  create_sandbox_public_token: async (userId: string = 'user-sandbox') => {
    const response = await apiClient.post<{ public_token: string }>(
      '/api/plaid/sandbox/public_token/create',
      { user_id: userId }
    );
    return response.data;
  },

  exchangePublicToken: async (publicToken: string, userId: string = 'user-sandbox') => {
    const response = await apiClient.post<{ access_token: string; item_id: string }>(
      '/api/plaid/exchange-token',
      {
        public_token: publicToken,
        user_id: userId,
      }
    );
    return response.data;
  },

  syncTransactions: async (itemId: string) => {
    const response = await apiClient.post<{ synced: boolean; item_id: string }>(
      `/api/plaid/sync-transactions/${itemId}`
    );
    return response.data;
  },
};
