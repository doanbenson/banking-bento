# Research Dossier: API Client Modularization

## Verified Codebase Anchors

### Current API Client Structure
- **File**: [apps/web/lib/api-client.ts](apps/web/lib/api-client.ts) — 181 lines total
  - Lines 1-16: URL resolution config
  - Lines 18-33: Type definitions (ApiEnvelope, BackendAccount, BackendTransaction)
  - Lines 35-39: unwrap() helper
  - Lines 41-52: mapAccount() and mapTransaction() mappers
  - Lines 54-62: axios client setup
  - Lines 91-115: plaidApi service definition
  - Lines 117-130: accountsApi service definition
  - Lines 133-142: transactionsApi service definition

### Consumer Usage Patterns
- **PlaidLinkButton.tsx** (line 7): imports `API_BASE_URL, plaidApi`
  - Calls: `plaidApi.createLinkToken()`, `plaidApi.exchangePublicToken()`
- **page.tsx** (line 4): imports `accountsApi, transactionsApi`
  - Calls: `accountsApi.getAll()`, `transactionsApi.getAll()`
- **transaction/page.tsx** (line 5): imports `transactionsApi`
  - Calls: `transactionsApi.getAll()`

All consumers expect the same exported names post-refactor.

### Environment Configuration Pattern
- Uses `process.env.NEXT_PUBLIC_API_URL` or `process.env.NEXT_PUBLIC_LOCALSTACK_API_ID`
- Resolution logic in `resolveApiBaseUrl()` (lines 6-15)
- Fallback to `http://localhost:4566` if neither env var is set
- Already exported as `API_BASE_URL` — must maintain this export

### API Response Contract
- All endpoints return `ApiEnvelope<T>`:
  ```
  { success: boolean; data?: T; error?: { code, message, details } }
  ```
- Every service call currently does `unwrap(response.data)` — this will move to client interceptor

### Current MapperCalls
- `mapAccount()` (line 41-52): BackendAccount → domain Account type
- `mapTransaction()` (line 53-63): BackendTransaction → domain Transaction type
- Both are called inline in service methods

### Type Usage Summary
- **Backend types** (API contracts): `ApiEnvelope`, `BackendAccount`, `BackendTransaction`
- **Domain types** (mapped for UI): implicit in map functions, need extraction
- No current type exports — types are internal-only

## Load-Bearing Constraints

1. **Axios instance must be single** — All requests share one client; interceptors are request-level, not instance-level
2. **Type generics matter** — Services use `<ApiEnvelope<T>>` for typing responses before unwrap; post-refactor, types shift to the mapper layer
3. **URL resolution happens once** — `API_BASE_URL` is computed at module load time, not per-request
4. **No auth headers today** — Config only handles base URL; no token injection in interceptors yet (future-safe but not needed now)

## Patterns to Preserve

1. **Default parameters** — plaidApi methods have `userId: string = 'user-sandbox'` defaults; preserve these
2. **Params object style** — transactionsApi uses `params: Record<string, string>` for query params; this is clean
3. **Response unwrap behavior** — Services promise already-unwrapped data; interceptor must maintain this contract
4. **Inline type instantiation** — Services use `apiClient.post<ApiEnvelope<T>>(...)`; this will shift to mapper layer or interceptor

## Suggested Implementation Shape

```
src/api/
├── config.ts              # resolveApiBaseUrl() + API_BASE_URL export
├── core/
│   └── client.ts          # axios instance + response interceptor for unwrap
├── types/
│   ├── backend.ts         # ApiEnvelope, BackendAccount, BackendTransaction
│   └── domain.ts          # Mapped Account, Transaction types
├── mappers/
│   └── account.mapper.ts   # mapAccount, mapTransaction
└── services/
    ├── plaid.service.ts
    ├── accounts.service.ts
    └── transactions.service.ts
```

### Service File Pattern
Each service should:
1. Import `apiClient` from `core/client.ts`
2. Import needed types from `types/backend.ts`
3. Import mappers from `mappers/`
4. Define service object with methods
5. Return unwrapped + mapped data (unwrapping handled by interceptor)

**Example**:
```typescript
// services/accounts.service.ts
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
    // response.data is already unwrapped by interceptor
    return response.data.accounts.map(mapAccount);
  },
};
```

## Gotchas & Open Questions

1. **Interceptor scope** — Axios response interceptor runs on *all* requests through this client. Ensure the unwrap logic handles both success and error cases cleanly. Consider: should errors be thrown or re-thrown?

2. **Type inference post-unwrap** — After the interceptor strips `ApiEnvelope`, the response type shifts. Need to ensure TypeScript still infers the correct `response.data` type in services.

3. **Module re-exports** — Plan likely exports each service from `services/index.ts`, but consumers import directly. Decide: do we provide `@/lib/api` as a namespace or keep direct imports?

## External References
- None strictly required; standard axios patterns apply.

