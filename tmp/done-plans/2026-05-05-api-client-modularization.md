# Implementation Plan: API Client Modularization with Interceptor Unwrapping & Nested Types

**Date**: May 5, 2026

## Summary

Refactor `lib/api-client.ts` (181 lines) into a modular structure with:
- Centralized URL configuration in `config.ts`
- Axios client with response interceptor that unwraps `ApiEnvelope` automatically
- Nested type organization (`types/backend.ts` for API contracts, `types/domain.ts` for mapped types)
- Individual service files (`plaid.service.ts`, `accounts.service.ts`, `transactions.service.ts`)
- Isolated mapper logic in `mappers/account.mapper.ts`

All existing imports (`@/lib/api-client`) continue to work without modification through re-export barrels.

---

## Intent / Why

The monolithic API client creates three friction points:
1. **Testing friction**: Can't isolate plaid logic from accounts logic; must mock entire client
2. **Scaling friction**: Adding a new service requires editing a 180+ line file with no clear insertion point
3. **Discoverability**: New developers don't know where plaid, accounts, and transactions logic lives

The modular structure solves this by:
- Making each service independently testable and importable
- Making it obvious where to add new services (new file in `services/`)
- Organizing types by semantic meaning (backend contracts vs. UI-friendly shapes)
- Centralizing response unwrapping so services don't repeat the `unwrap()` call

---

## Source Artifacts

- **Intent & Brief**: `./tmp/plan-artifacts/2026-05-05-api-client-modularization-brief.md`
- **Research Dossier**: `./tmp/plan-artifacts/2026-05-05-api-client-modularization-research-dossier.md`

---

## Verified Repo Truths

### API Client Today
- **Fact**: `lib/api-client.ts` is 181 lines and contains configuration, types, mappers, client setup, and all 3 services.
- **Evidence**: [apps/web/lib/api-client.ts](apps/web/lib/api-client.ts) (entire file)
- **Implication**: Every new service addition requires editing this single file; impossible to test services in isolation.

### Consumers & Exports
- **Fact**: Three services and one config constant are exported: `plaidApi`, `accountsApi`, `transactionsApi`, `API_BASE_URL`.
- **Evidence**: [apps/web/lib/api-client.ts](apps/web/lib/api-client.ts) (lines 91, 117, 133, 14)
- **Implication**: Re-export barrels must maintain these exact names and shapes to preserve consumer imports.

### Consumer Import Patterns
- **Fact**: PlaidLinkButton imports `API_BASE_URL, plaidApi` and calls `createLinkToken()` and `exchangePublicToken()`.
- **Evidence**: [apps/web/components/bank/PlaidLinkButton.tsx](apps/web/components/bank/PlaidLinkButton.tsx#L7), lines 37, 64
- **Implication**: `plaidApi` export must remain a plain object with these methods; no class wrapping.

- **Fact**: page.tsx imports both `accountsApi` and `transactionsApi` and calls `getAll()` on both.
- **Evidence**: [apps/web/app/page.tsx](apps/web/app/page.tsx#L4), lines 49-50
- **Implication**: Both services must export the same interface shape today as they do in the monolith.

- **Fact**: transaction/page.tsx imports only `transactionsApi` and calls `getAll()`.
- **Evidence**: [apps/web/app/transaction/page.tsx](apps/web/app/transaction/page.tsx#L5), line 30
- **Implication**: Services can be imported independently; no forced co-imports.

### API Response Contract
- **Fact**: All endpoints return `ApiEnvelope<T>` with shape `{ success: boolean; data?: T; error?: { code, message, details } }`.
- **Evidence**: [apps/web/lib/api-client.ts](apps/web/lib/api-client.ts#L18-L25)
- **Implication**: Response interceptor must unwrap this shape consistently for all requests.

### Environment Configuration
- **Fact**: Base URL resolution checks `NEXT_PUBLIC_API_URL`, then `NEXT_PUBLIC_LOCALSTACK_API_ID`, then falls back to `http://localhost:4566`.
- **Evidence**: [apps/web/lib/api-client.ts](apps/web/lib/api-client.ts#L6-L15)
- **Implication**: `config.ts` must replicate this exact resolution logic.

### Axios Client Setup
- **Fact**: Single axios instance created with `baseURL: API_BASE_URL` and `'Content-Type': 'application/json'` header.
- **Evidence**: [apps/web/lib/api-client.ts](apps/web/lib/api-client.ts#L54-L62)
- **Implication**: `core/client.ts` must set up this client once; all services share it.

### Type Definitions
- **Fact**: Four types exist inline: `ApiEnvelope`, `BackendAccount`, `BackendTransaction`. Backend types use snake_case; mapped types use camelCase.
- **Evidence**: [apps/web/lib/api-client.ts](apps/web/lib/api-client.ts#L18-L33)
- **Implication**: Backend types belong in `types/backend.ts`; mapped types (Account, Transaction) belong in `types/domain.ts`.

### Mapper Functions
- **Fact**: Two mappers exist: `mapAccount()` (lines 41-52) and `mapTransaction()` (lines 53-63). They convert backend snake_case to domain camelCase.
- **Evidence**: [apps/web/lib/api-client.ts](apps/web/lib/api-client.ts#L41-L63)
- **Implication**: These must be extracted to `mappers/account.mapper.ts` and exported for services to import.

### Service Method Patterns
- **Fact**: All service methods follow pattern: `apiClient.post/get<ApiEnvelope<T>>(...) → unwrap(response.data) → optionally map → return`.
- **Evidence**: [apps/web/lib/api-client.ts](apps/web/lib/api-client.ts#L91-L142)
- **Implication**: Post-refactor, unwrapping moves to interceptor; services call `apiClient.post/get<T>(...)` with T = already-unwrapped shape.

### No Existing lib/api Directory
- **Fact**: `lib/` contains only `api-client.ts` and `utils.ts` today; no `api/` subdirectory.
- **Evidence**: File search on `apps/web/lib/**` returns only those two files.
- **Implication**: We are creating the entire `api/` directory structure from scratch.

### No Circular Dependencies Risk
- **Fact**: Current code has no internal dependencies between type definitions, mappers, or services (all inline).
- **Evidence**: [apps/web/lib/api-client.ts](apps/web/lib/api-client.ts) is self-contained.
- **Implication**: New modular structure (config → client → services/mappers/types) will have clear dependency arrows; no risk of cycles.

---

## Locked Decisions

1. **Interceptor unwrapping** — Response unwrapping moves from each service method (`unwrap(response.data)`) to a single axios response interceptor. This reduces boilerplate and centralizes error handling.

2. **Nested type files** — Two files: `types/backend.ts` for API contracts (`ApiEnvelope`, `BackendAccount`, `BackendTransaction`), `types/domain.ts` for frontend shapes (mapped `Account`, `Transaction`).

3. **Service-level isolation** — Each service gets its own file under `services/`. No classes; plain objects with methods.

4. **Mapper extraction** — Data transformation logic isolated in `mappers/account.mapper.ts`. Services import and call these functions.

5. **Backwards-compatible exports** — `lib/api-client.ts` becomes a re-export barrel that imports from the new `api/` subdirectory and re-exports `plaidApi`, `accountsApi`, `transactionsApi`, `API_BASE_URL` with identical signatures.

6. **No authentication layer** — Interceptor handles only response unwrapping. Auth tokens, if needed, will be added later.

---

## Known Mismatches / Assumptions

### Assumption 1: Interceptor Error Handling
The current code has no error handling around `unwrap()` — it just calls `unwrap(response.data)`. We are assuming:
- The interceptor should be added to `response.use()`, not `request.use()`
- The interceptor receives `response.data` already parsed by axios
- If `response.success === false`, the interceptor should throw an error with the API's error message
- Callers can catch this error with `.catch()` (current pattern in PlaidLinkButton.tsx shows error logging)

If a different error strategy is needed (e.g., return a Result<T, E> type instead of throwing), this should be clarified.

### Assumption 2: Type Re-exports in Domain
The mapped types (Account, Transaction) will be new exports in `types/domain.ts`. We are assuming:
- Services will export these mapped types for consumers to use in type annotations
- The current codebase has no explicit exports of mapped types (they're implicit in map function signatures)
- It's safe to create these exports now

### Assumption 3: Barrel Re-export Location
We are keeping re-exports in `lib/api-client.ts` rather than moving API to `lib/api/index.ts`. This assumes:
- All existing imports like `import { plaidApi } from '@/lib/api-client'` should continue to work unchanged
- Having both `lib/api-client.ts` (barrel) and `lib/api/` (implementation) is acceptable architectural duplication

---

## Critical Codebase Anchors

1. **[apps/web/lib/api-client.ts](apps/web/lib/api-client.ts)** — Source of truth for current implementation; all types, mappers, and service definitions extracted from here.

2. **[apps/web/components/bank/PlaidLinkButton.tsx](apps/web/components/bank/PlaidLinkButton.tsx#L7)** — Primary consumer of `plaidApi`; verify imports work post-refactor.

3. **[apps/web/app/page.tsx](apps/web/app/page.tsx#L4)** — Primary consumer of both `accountsApi` and `transactionsApi`; verify both imports and method calls work.

4. **[apps/web/app/transaction/page.tsx](apps/web/app/transaction/page.tsx#L5)** — Consumer of `transactionsApi` only; verify isolated import works.

---

## Files Being Changed

```
apps/web/lib/
├── api/                           ← NEW DIRECTORY
│   ├── config.ts                  ← NEW: URL resolution
│   ├── core/
│   │   └── client.ts              ← NEW: axios instance + interceptor
│   ├── types/
│   │   ├── backend.ts             ← NEW: API contracts (ApiEnvelope, BackendAccount, etc.)
│   │   └── domain.ts              ← NEW: Mapped frontend types (Account, Transaction)
│   ├── mappers/
│   │   └── account.mapper.ts       ← NEW: mapAccount, mapTransaction
│   └── services/
│       ├── plaid.service.ts        ← NEW: plaidApi
│       ├── accounts.service.ts     ← NEW: accountsApi
│       └── transactions.service.ts ← NEW: transactionsApi
└── api-client.ts                  ← MODIFIED: Re-export barrel (reduced from 181 lines to ~15 lines)
```

---

## Reconciliation Notes

**Reconciliation against research dossier**:
- Dossier suggested nestingservices under `src/api/` in a backend project context. We've adjusted to `apps/web/lib/api/` to match the actual Next.js web app location.
- Dossier flagged interceptor error handling as an open question. We've resolved this by assuming synchronous throw behavior (consistent with current `unwrap()` pattern).
- Dossier noted type inference post-unwrap as a potential gotcha. We've noted this in the Key Pseudocode section below and will verify TypeScript inference during implementation.

---

## Delta Design

### Interceptor Implementation
The response interceptor must:
1. Check if `response.data.success === true`
2. If yes, replace `response.data` with `response.data.data` (unwrap)
3. If no, throw an error with the API error message
4. If neither success nor error field exists, pass response through unchanged (for non-API responses)

```typescript
// core/client.ts interceptor pseudo-code
apiClient.interceptors.response.use(
  (response) => {
    const data = response.data;
    // Only unwrap if it looks like an ApiEnvelope
    if (typeof data === 'object' && data !== null && 'success' in data) {
      if (data.success) {
        response.data = data.data;
        return response;
      } else {
        throw new Error(data.error?.message || 'API request failed');
      }
    }
    // Pass through unchanged if not an ApiEnvelope
    return response;
  },
  (error) => Promise.reject(error)
);
```

### Type Shifting Post-Unwrap
Services will shift from:
```typescript
// Before (monolith)
const response = await apiClient.post<ApiEnvelope<{ link_token: string }>>('/api/plaid/create-link-token', ...);
const unwrapped = unwrap(response.data); // unwrapped: { link_token: string }
```

To:
```typescript
// After (modular)
const response = await apiClient.post<{ link_token: string }>('/api/plaid/create-link-token', ...);
// response.data is already unwrapped by interceptor
```

### Type Domain Exports
New exports in `types/domain.ts`:
```typescript
export type Account = ReturnType<typeof mapAccount>;
export type Transaction = ReturnType<typeof mapTransaction>;
```

This allows services and consumers to use these types for annotations.

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│         Consumer Components              │
│  (PlaidLinkButton, page, etc.)          │
└────────────────┬────────────────────────┘
                 │ imports plaidApi, accountsApi, etc.
                 ↓
┌─────────────────────────────────────────┐
│    lib/api-client.ts (Re-export Barrel) │
│  - Re-exports plaidApi, accountsApi...  │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│         lib/api/services/               │
│  - plaid.service.ts                     │
│  - accounts.service.ts                  │
│  - transactions.service.ts              │
└────────────┬──────────────────┬─────────┘
             │                  │
      ┌──────↓──────────────────↓──────┐
      │   lib/api/core/client.ts       │
      │  (axios + response interceptor) │
      │  (unwraps ApiEnvelope)         │
      └──────┬───────────────────────┬──┘
             │                       │
     ┌───────↓──────┐      ┌────────↓──────┐
     │  lib/api/    │      │  lib/api/     │
     │  mappers/    │      │  types/       │
     │  *.mapper.ts │      │  backend.ts   │
     │              │      │  domain.ts    │
     └──────────────┘      └───────────────┘
```

---

## Key Pseudocode

### 1. Response Interceptor (core/client.ts)

```typescript
import axios from 'axios';
import { API_BASE_URL } from '../config';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor: unwrap ApiEnvelope
apiClient.interceptors.response.use(
  (response) => {
    const data = response.data;
    // Check if response is an ApiEnvelope (has success field)
    if (data && typeof data === 'object' && 'success' in data) {
      if (data.success) {
        // Replace response.data with unwrapped data.data
        response.data = data.data;
        return response;
      } else {
        // Throw with API error message
        throw new Error(data.error?.message || 'API request failed');
      }
    }
    // Not an ApiEnvelope, pass through
    return response;
  },
  (error) => Promise.reject(error)
);

export default apiClient;
```

**Gotcha**: The interceptor checks `'success' in data` to avoid breaking non-API responses (if any). This is defensive but safe.

### 2. Type Inference Post-Unwrap

After the interceptor runs, the type of `response.data` changes:

```typescript
// Before interceptor (axios perspective): response.data has type ApiEnvelope<T>
// After interceptor (our mutation): response.data has type T

// In a service:
const response = await apiClient.post<{ link_token: string }>(
  '/api/plaid/create-link-token',
  { user_id: userId }
);
// Type of response.data: { link_token: string } (already unwrapped)
```

**Gotcha**: TypeScript doesn't understand that the interceptor mutates the type. We handle this by:
1. Specifying `<T>` as the unwrapped type in the `apiClient.post<T>()` call
2. The interceptor guarantees this type is what lands in `response.data`
3. Services trust this contract

### 3. Service Implementation Pattern

```typescript
// services/plaid.service.ts
import apiClient from '../core/client';
import { mapAccount } from '../mappers/account.mapper';

export const plaidApi = {
  createLinkToken: async (userId: string = 'user-sandbox') => {
    const response = await apiClient.post<{ link_token: string }>(
      '/api/plaid/create-link-token',
      { user_id: userId }
    );
    // response.data is already unwrapped by interceptor
    return response.data;
  },

  exchangePublicToken: async (publicToken: string, userId: string = 'user-sandbox') => {
    const response = await apiClient.post<{ access_token: string; item_id: string }>(
      '/api/plaid/exchange-token',
      { public_token: publicToken, user_id: userId }
    );
    return response.data;
  },

  syncTransactions: async (itemId: string) => {
    const response = await apiClient.post<{ synced: boolean; item_id: string }>(
      `/api/plaid/sync-transactions/${itemId}`
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
};
```

No `unwrap()` call needed — the interceptor already did it.

### 4. Mapper Pattern

```typescript
// mappers/account.mapper.ts
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
```

No changes from current; just extraction.

---

## Tasks

### Task 1: Create config.ts
- Extract `resolveApiBaseUrl()` function and `API_BASE_URL` computation from current api-client.ts
- Save to `apps/web/lib/api/config.ts`
- Ensure exact same logic (check NEXT_PUBLIC_API_URL → NEXT_PUBLIC_LOCALSTACK_API_ID → fallback)

### Task 2: Create type files
- Create `apps/web/lib/api/types/backend.ts` with `ApiEnvelope`, `BackendAccount`, `BackendTransaction`
- Create `apps/web/lib/api/types/domain.ts` with exported mapped types (Account, Transaction)
- Ensure no dependencies between these two files

### Task 3: Create mappers/account.mapper.ts
- Extract `mapAccount()` and `mapTransaction()` from current api-client.ts
- Save to `apps/web/lib/api/mappers/account.mapper.ts`
- Import BackendAccount, BackendTransaction from types/backend.ts

### Task 4: Create core/client.ts
- Set up axios instance with baseURL from config.ts
- Add response interceptor that unwraps ApiEnvelope
- Export the configured client as default export

### Task 5: Create services/plaid.service.ts
- Extract plaidApi object from current api-client.ts
- Update service methods to use unwrapped types (no unwrap() call)
- Import mappers and types as needed

### Task 6: Create services/accounts.service.ts
- Extract accountsApi object from current api-client.ts
- Update service methods to use unwrapped types
- Import mappers and types as needed

### Task 7: Create services/transactions.service.ts
- Extract transactionsApi object from current api-client.ts
- Update service methods to use unwrapped types
- Import mappers and types as needed

### Task 8: Replace lib/api-client.ts with re-export barrel
- Clear existing content
- Add imports: `import { plaidApi } from './api/services/plaid.service'`; etc.
- Re-export all three services and API_BASE_URL
- Verify signature matches original exports (names, types, shapes)

### Task 9: Verify imports in consumers
- Test that PlaidLinkButton.tsx imports still work: `import { API_BASE_URL, plaidApi }`
- Test that page.tsx imports still work: `import { accountsApi, transactionsApi }`
- Test that transaction/page.tsx import still works: `import { transactionsApi }`
- Run type checking to confirm no breaking changes

---

## Validation

### Compile/Type Check
- Run `npm run build` or `tsc --noEmit` in apps/web to ensure no type errors
- Verify no circular dependency warnings from webpack or TypeScript

### Import Verification
- Grep workspace for `from '@/lib/api-client'` to find all consumers
- Verify each consumer's import statement still resolves correctly
- Check that IDE autocomplete shows the same exports (plaidApi, accountsApi, transactionsApi, API_BASE_URL)

### Runtime Spot-Checks
- Start the dev server: `npm run dev` in apps/web
- Open PlaidLinkButton and verify `createLinkToken()` call doesn't error (or errors the same way as before if backend is down)
- Verify page loads and makes account/transaction API calls
- Check browser console for any import errors

### Code Review Checklist
- All interceptor logic is deterministic and handles edge cases (non-ApiEnvelope responses)
- No circular imports between config, client, types, mappers, services
- Services use consistent naming (camelCase methods, snake_case params)
- Mappers are pure functions with no side effects
- Type annotations are explicit (no `any` types except where truly necessary)

---

## Deprecated Code to Remove

After successful refactor, delete the old monolithic file:
- ❌ `apps/web/lib/api-client.ts` (original file — replaced by barrel re-export)

However, we are keeping a `lib/api-client.ts` file as a re-export barrel for backwards compatibility. Only the original monolithic implementation is removed.

---

## Open Questions

None. All design decisions are locked based on the discussion.

---

## Next Steps

Once this plan is approved:
1. Run `/implement ./tmp/ready-plans/2026-05-05-api-client-modularization.md` to execute all file changes
2. Run `npm run build` to verify types
3. Run dev server to spot-check imports and API calls
