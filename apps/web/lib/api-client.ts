// Re-export barrel for backwards compatibility
// The implementation has been moved to lib/api/* subdirectory for modularity

export { API_BASE_URL } from './api/config';
export { plaidApi } from './api/services/plaid.service';
export { accountsApi } from './api/services/accounts.service';
export { transactionsApi } from './api/services/transactions.service';
export { transferApi } from './api/services/transfer.service';
export { default } from './api/core/client';