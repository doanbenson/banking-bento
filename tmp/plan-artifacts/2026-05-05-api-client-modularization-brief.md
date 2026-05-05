# Intent & Brief: API Client Modularization

## Problem / Outcome
The web app's `lib/api-client.ts` is a 180+ line monolith that mixes configuration, HTTP setup, types, mappers, and 3 service APIs in one file. This creates testing friction, poor discoverability, and scaling friction as new services are added.

Desired outcome: Modular, testable, discoverable API structure that scales cleanly.

## Who This Matters For
- Developers adding new API services (should be obvious where to add code)
- Test engineers (should be able to mock services in isolation)
- Maintainers (should understand the flow without reading 180 lines)

## Locked Decisions
1. **Response unwrapping in client interceptors** — The `ApiEnvelope` unwrapping logic moves to axios response interceptors, not services. Services receive already-unwrapped data.
2. **Nested type structure** — Two type files: `types/backend.ts` for API contracts, `types/domain.ts` for mapped frontend types.
3. **Service-level isolation** — Each service (plaid, accounts, transactions) gets its own file under `services/`.
4. **Mappers remain separate** — Data transformation logic lives in `mappers/` for clarity.

## Non-Goals
- Backwards compatibility shims or re-exports
- Test file creation (tests are separate)
- API authentication / token management (not in scope)
- Error boundary UI changes

## Success Criteria
1. All existing imports from `@/lib/api-client` continue to work without modification
2. Services are independently importable and testable
3. Type organization is self-documenting (backend vs. domain types clearly separated)
4. No circular dependencies
5. Code is as DRY as the original (no unnecessary boilerplate)

## Explicit Constraints
- Maintain the current API surface exports (`plaidApi`, `accountsApi`, `transactionsApi`, `API_BASE_URL`)
- Preserve response envelope unwrapping behavior for all requests
- All 3 services (plaid, accounts, transactions) must be refactored in this pass
