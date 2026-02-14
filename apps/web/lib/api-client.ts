import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Plaid API
export const plaidApi = {
  createLinkToken: async (userId: string = 'user-sandbox') => {
    const response = await apiClient.post('/api/plaid/create-link-token', { user_id: userId });
    return response.data;
  },

  create_sandbox_public_token: async (userId: string = 'user-sandbox') => {
    const response = await apiClient.post('/api/plaid/sandbox/public_token/create', { user_id: userId });
    return response.data;
  },

  exchangePublicToken: async (publicToken: string, userId: string = 'user-sandbox') => {
    const response = await apiClient.post('/api/plaid/exchange-token', {
      public_token: publicToken,
      user_id: userId,
    });
    return response.data;
  },

  syncTransactions: async (itemId: string) => {
    const response = await apiClient.post(`/api/plaid/sync-transactions/${itemId}`);
    return response.data;
  },
};

// Accounts API
export const accountsApi = {
  getAll: async (userId?: string) => {
    const params = userId ? { user_id: userId } : {};
    const response = await apiClient.get('/api/accounts', { params });
    return response.data;
  },

  getById: async (accountId: string) => {
    const response = await apiClient.get(`/api/accounts/${accountId}`);
    return response.data;
  },
};

// Transactions API
export const transactionsApi = {
  getAll: async (userId?: string, accountId?: string) => {
    const params: any = {};
    if (userId) params.user_id = userId;
    if (accountId) params.account_id = accountId;
    
    const response = await apiClient.get('/api/transactions', { params });
    return response.data;
  },
};

// Trading API
export const tradingApi = {
  // Account
  getAccount: async () => {
    const response = await apiClient.get('/api/trading/account');
    return response.data;
  },

  // Positions
  getPositions: async () => {
    const response = await apiClient.get('/api/trading/positions');
    return response.data;
  },

  getPosition: async (symbol: string) => {
    const response = await apiClient.get(`/api/trading/positions/${symbol.toUpperCase()}`);
    return response.data;
  },

  closePosition: async (symbol: string, qty?: number) => {
    const response = await apiClient.delete(`/api/trading/positions/${symbol.toUpperCase()}`, {
      data: qty ? { qty } : {}
    });
    return response.data;
  },

  // Orders
  getOrders: async (status: 'open' | 'closed' | 'all' = 'open') => {
    const response = await apiClient.get('/api/trading/orders', {
      params: { status }
    });
    return response.data;
  },

  getOrder: async (orderId: string) => {
    const response = await apiClient.get(`/api/trading/orders/${orderId}`);
    return response.data;
  },

  placeOrder: async (params: {
    symbol: string;
    qty: number;
    side: 'buy' | 'sell';
    type?: 'market' | 'limit';
    limit_price?: number;
  }) => {
    const response = await apiClient.post('/api/trading/orders', {
      symbol: params.symbol.toUpperCase(),
      qty: params.qty,
      side: params.side,
      type: params.type || 'market',
      limit_price: params.limit_price
    });
    return response.data;
  },

  placeMarketOrder: async (symbol: string, qty: number, side: 'buy' | 'sell') => {
    return tradingApi.placeOrder({ symbol, qty, side, type: 'market' });
  },

  placeLimitOrder: async (symbol: string, qty: number, side: 'buy' | 'sell', limitPrice: number) => {
    return tradingApi.placeOrder({ symbol, qty, side, type: 'limit', limit_price: limitPrice });
  },

  cancelOrder: async (orderId: string) => {
    const response = await apiClient.delete(`/api/trading/orders/${orderId}`);
    return response.data;
  },

  // Market Data
  getMarketData: async (symbol: string, timeframe: string = '1Day', days: number = 30) => {
    const response = await apiClient.get(`/api/trading/market/${symbol.toUpperCase()}`, {
      params: { timeframe, days }
    });
    return response.data;
  },

  getQuote: async (symbol: string) => {
    const response = await apiClient.get(`/api/trading/quote/${symbol.toUpperCase()}`);
    return response.data;
  },

  // Portfolio
  getPortfolioPerformance: async () => {
    const response = await apiClient.get('/api/trading/portfolio/performance');
    return response.data;
  },
};

export default apiClient;