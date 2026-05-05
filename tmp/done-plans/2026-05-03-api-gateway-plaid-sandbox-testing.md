# Implementation Plan: API Gateway Setup for Frontend + Plaid Sandbox

## Summary
This plan replaces the current per-Lambda Function URL frontend integration with a single API Gateway surface in the serverless backend. It aligns route contracts with the existing frontend client paths, switches API handlers from in-memory repository construction to DynamoDB-backed repository construction, and introduces a shared response/error envelope utility so all API lambdas return a consistent format.

The plan keeps webhook-triggered async sync behavior intact, while making frontend sandbox testing deterministic and closer to production architecture.

## Intent / Why
- Enable reliable end-to-end frontend testing against serverless backend routes under one base URL.
- Support Plaid sandbox flows (link token, token exchange, sync) without bespoke endpoint mapping per lambda URL.
- Remove response-format drift that currently forces handler-specific frontend assumptions.
- Move API read/sync paths to AWS-backed persistence so behavior survives cold starts and separate invocations.

## Source Artifacts
- Brief / intent artifact: tmp/plan-artifacts/2026-05-03-api-gateway-plaid-sandbox-testing-brief.md
- Research dossier: tmp/plan-artifacts/2026-05-03-api-gateway-plaid-sandbox-testing-research-dossier.md

## Verified Repo Truths

### Entry Points / Integrations
- Fact: The backend stack composes database, workflow, and webhook constructs from one stack entrypoint.
  Evidence: apps/serverless-backend/lib/banking-core-stack.ts:12-20
  Implication: The HTTP integration surface is stack-level construct composition.

- Fact: The HTTP-facing backend construct currently creates one NodejsFunction per API lambda and attaches Function URLs.
  Evidence: apps/serverless-backend/lib/constructs/webhooks.ts:36-43
  Implication: Frontend path routing is not centralized today.

- Fact: API lambdas are currently registered by filename in the webhooks construct.
  Evidence: apps/serverless-backend/lib/constructs/webhooks.ts:47-52
  Implication: Existing lambda set can be reused as API Gateway integrations instead of creating new business handlers.

- Fact: There is no API Gateway construct usage in backend infra sources.
  Evidence: apps/serverless-backend/lib/constructs/webhooks.ts:1-59
  Implication: API Gateway wiring is net-new infra work.
  Search Evidence: grep query aws-apigateway|aws-apigatewayv2|RestApi|HttpApi over apps/serverless-backend/lib/** returned no matches.

### Frontend / UI
- Fact: Frontend HTTP client is path-based and expects one base URL from NEXT_PUBLIC_API_URL.
  Evidence: apps/web/lib/api-client.ts:3-6
  Implication: API Gateway with stable routes directly matches existing frontend integration style.

- Fact: Frontend calls Plaid routes /api/plaid/create-link-token, /api/plaid/sandbox/public_token/create, /api/plaid/exchange-token, and /api/plaid/sync-transactions/:itemId.
  Evidence: apps/web/lib/api-client.ts:15-33
  Implication: Frontend route names are explicit and path-based.

- Fact: Frontend accounts and transactions calls use /api/accounts and /api/transactions and send user_id query parameter.
  Evidence: apps/web/lib/api-client.ts:41-42; apps/web/lib/api-client.ts:56-59
  Implication: Frontend query naming is snake_case.

- Fact: Dashboard state expects wrapped payloads with accountsData.accounts and transactionsData.transactions.
  Evidence: apps/web/app/page.tsx:53-54
  Implication: Current backend raw-array responses are contract-mismatched for the page data assignment.

- Fact: Plaid Link component is wired to createLinkToken and exchangePublicToken and defaults userId to user-sandbox.
  Evidence: apps/web/components/bank/PlaidLinkButton.tsx:26-26; apps/web/components/bank/PlaidLinkButton.tsx:37-37; apps/web/components/bank/PlaidLinkButton.tsx:57-57
  Implication: Plaid frontend flow depends on these two client calls and default sandbox user.

### Data / State
- Fact: Repository abstraction defines AccountRepository and TransactionRepository and exposes them in BankingCoreRepositories.
  Evidence: apps/serverless-backend/src/repositories/interfaces.ts:22-27; apps/serverless-backend/src/repositories/interfaces.ts:76-84
  Implication: Data source migration can happen at repository factory wiring without redesigning domain contracts.

- Fact: Both in-memory and Dynamo repository factory functions exist.
  Evidence: apps/serverless-backend/src/repositories/in-memory-banking-core-repositories.ts:208-216; apps/serverless-backend/src/repositories/dynamodb-banking-core-repositories.ts:532-541
  Implication: API handlers can switch factories with minimal handler logic churn.

- Fact: API handlers for accounts, transactions, and sync currently instantiate in-memory repositories.
  Evidence: apps/serverless-backend/src/lambdas/api-accounts-get.ts:2-4; apps/serverless-backend/src/lambdas/api-transactions-get.ts:2-4; apps/serverless-backend/src/lambdas/api-plaid-sync.ts:2-4
  Implication: Current API testing does not reflect persisted behavior.

- Fact: Database construct defines pk/sk lowercase key names.
  Evidence: apps/serverless-backend/lib/constructs/database.ts:12-13
  Implication: Infra key casing differs from repository/schema key casing.

- Fact: Dynamo schema and repository code use uppercase PK/SK and GSI1/GSI2 attribute names.
  Evidence: apps/serverless-backend/src/dynamodb/schema.ts:49-50; apps/serverless-backend/src/dynamodb/schema.ts:53-58; apps/serverless-backend/src/repositories/dynamodb-banking-core-repositories.ts:37-37
  Implication: Table definition in infra and repository assumptions are currently inconsistent.

### Execution / Async Flow
- Fact: Webhook ingress invokes Plaid sync lambda asynchronously via Lambda InvokeCommand.
  Evidence: apps/serverless-backend/src/lambdas/plaid-webhook-ingress.ts:113-120
  Implication: Sync has an existing async invocation path independent of frontend routes.

- Fact: Webhooks construct passes PLAID_SYNC_LAMBDA_NAME and invoke permission to webhook lambda.
  Evidence: apps/serverless-backend/lib/constructs/webhooks.ts:54-55
  Implication: Webhook and sync lambdas are already connected through env + invoke grants.

### Validation / Build Workflow
- Fact: Serverless backend workspace exposes build and deploy:local scripts, but no lint/typecheck scripts.
  Evidence: apps/serverless-backend/package.json:6-7
  Implication: Backend validation commands are currently build/deploy-oriented.

- Fact: Web workspace exposes dev/build/start/lint scripts.
  Evidence: apps/web/package.json:6-9
  Implication: Frontend validation can use lint/build scripts in workspace config.

### Negative/Absence Facts
- Fact: No validator/controller/service directories exist under serverless-backend src.
  Evidence: apps/serverless-backend/src/lambdas/api-accounts-get.ts:1-4
  Implication: Backend organization is lambda + repository oriented.
  Search Evidence: file search for apps/serverless-backend/src/**/*validator*, **/*controller*, **/*service* returned no files.

- Fact: No shared API response helper utility exists in backend sources.
  Evidence: apps/serverless-backend/src/lambdas/api-accounts-get.ts:6-21; apps/serverless-backend/src/lambdas/api-transactions-get.ts:6-21
  Implication: Standard response/error format requires a new shared utility.
  Search Evidence: grep query formatResponse|successResponse|errorResponse|responseBuilder|apiResponse over apps/serverless-backend/src/** returned no matches.

- Fact: Backend source does not contain sync-transactions route string used by frontend.
  Evidence: apps/web/lib/api-client.ts:33-33
  Implication: Frontend sync path name is not present in backend source strings.
  Search Evidence: grep query sync-transactions over apps/serverless-backend/src/** returned no matches.

## Locked Decisions
- Add API Gateway as the primary frontend-facing API surface.
- Move API read/sync handlers to DynamoDB-backed repository usage (AWS persistence), replacing in-memory default usage in those handlers.
- Enforce one consistent success/error response envelope across API lambdas.
- Keep webhook async invocation model intact.
- Do not add compatibility shims/fallback paths beyond direct replacement routing.

## Known Mismatches / Assumptions
- Mismatch: Frontend sends user_id while API handlers read userId.
  Repo Evidence: apps/web/lib/api-client.ts:41-41; apps/web/lib/api-client.ts:56-56; apps/serverless-backend/src/lambdas/api-accounts-get.ts:8-8; apps/serverless-backend/src/lambdas/api-transactions-get.ts:8-8
  Requirement Evidence: tmp/plan-artifacts/2026-05-03-api-gateway-plaid-sandbox-testing-brief.md (frontend testing stability)
  Planning Decision: Normalize query parsing to accept user_id route/query naming in API handlers.

- Mismatch: Dashboard expects wrapped payload objects while backend returns raw arrays.
  Repo Evidence: apps/web/app/page.tsx:53-54; apps/serverless-backend/src/lambdas/api-accounts-get.ts:14-14; apps/serverless-backend/src/lambdas/api-transactions-get.ts:14-14
  Requirement Evidence: tmp/plan-artifacts/2026-05-03-api-gateway-plaid-sandbox-testing-brief.md (consistent response standard)
  Planning Decision: Adopt shared envelope and update handlers to return stable wrapped data.

- Mismatch: Database construct key names are lowercase pk/sk while repository/schema contract uses uppercase PK/SK.
  Repo Evidence: apps/serverless-backend/lib/constructs/database.ts:12-13; apps/serverless-backend/src/dynamodb/schema.ts:49-50
  Requirement Evidence: tmp/plan-artifacts/2026-05-03-api-gateway-plaid-sandbox-testing-brief.md (DynamoDB-backed behavior)
  Planning Decision: Update table construct to uppercase PK/SK + required GSIs before switching API handlers to Dynamo repository client.

- Assumption: Sandbox test environment can remain unauthenticated for now (no authorizer) to prioritize route and payload integration.
  Repo Evidence: apps/serverless-backend/lib/constructs/webhooks.ts:28-28; apps/serverless-backend/lib/constructs/webhooks.ts:42-42
  Requirement Evidence: User request emphasizes frontend sandbox testing first.
  Planning Decision: Use unauthenticated API Gateway stage initially; keep auth extension as post-plan follow-up.

## Critical Codebase Anchors
- Anchor: Frontend HTTP contract and route/path/query naming.
  Evidence: apps/web/lib/api-client.ts:3-60
  Reuse / Watch for: Preserve route names and user_id payload/query conventions during gateway routing.

- Anchor: Current HTTP infrastructure registration point.
  Evidence: apps/serverless-backend/lib/constructs/webhooks.ts:36-52
  Reuse / Watch for: Reuse lambda registration/factory pattern to avoid duplicating function definitions.

- Anchor: Async Plaid webhook-to-sync wiring.
  Evidence: apps/serverless-backend/lib/constructs/webhooks.ts:54-55; apps/serverless-backend/src/lambdas/plaid-webhook-ingress.ts:113-120
  Reuse / Watch for: Keep existing invoke permissions/env contract while adding gateway resources.

- Anchor: Repository abstraction seam for persistence migration.
  Evidence: apps/serverless-backend/src/repositories/interfaces.ts:22-84; apps/serverless-backend/src/repositories/dynamodb-banking-core-repositories.ts:532-541
  Reuse / Watch for: Swap concrete factory/client wiring, not domain repository interfaces.

- Anchor: Inbound idempotency dual implementation pattern.
  Evidence: apps/serverless-backend/src/idempotency/inbound-lock-repository.ts:28-64; apps/serverless-backend/src/idempotency/inbound-lock-repository.ts:80-127
  Reuse / Watch for: Keep in-memory vs AWS-backed strategy explicit and injectable.

## All Needed Context

### Documentation & References
- Repo reference: apps/serverless-backend/lib/constructs/webhooks.ts
  Why: Current HTTP exposure and lambda registration pattern to replace with gateway integrations.

- Repo reference: apps/serverless-backend/src/lambdas/plaid-webhook-ingress.ts
  Why: Existing webhook async trigger flow that must survive HTTP front-door changes.

- Repo reference: apps/serverless-backend/src/repositories/dynamodb-banking-core-repositories.ts
  Why: Existing Dynamo repository implementation to wire into API handlers.

- Repo reference: apps/serverless-backend/src/repositories/client.ts
  Why: Contract that requires a concrete Dynamo client implementation for runtime.

- Repo reference: apps/web/lib/api-client.ts
  Why: Canonical frontend route contract this plan targets.

### Files Being Changed
```text
apps/serverless-backend/
├── lib/
│   ├── banking-core-stack.ts ← MODIFIED (existing)
│   └── constructs/
│       ├── database.ts ← MODIFIED (existing)
│       ├── webhooks.ts ← MODIFIED (existing)
│       └── api-gateway.ts ← NEW (new)
├── src/
│   ├── lambdas/
│   │   ├── api-accounts-get.ts ← MODIFIED (existing)
│   │   ├── api-transactions-get.ts ← MODIFIED (existing)
│   │   ├── api-plaid-create-link-token.ts ← MODIFIED (existing)
│   │   ├── api-plaid-exchange-token.ts ← MODIFIED (existing)
│   │   ├── api-plaid-sandbox-create.ts ← MODIFIED (existing)
│   │   ├── api-plaid-sync.ts ← MODIFIED (existing)
│   │   └── shared/api-response.ts ← NEW (new)
│   └── repositories/
│       └── aws-dynamo-repository-client.ts ← NEW (new)
└── package.json ← MODIFIED (existing, add AWS SDK Dynamo deps if missing)

apps/web/
├── app/
│   └── page.tsx ← MODIFIED (existing)
└── lib/
    └── api-client.ts ← MODIFIED (existing, base URL + param/response compatibility cleanup)
```

### Known Gotchas & Library Quirks
- Current backend handlers are typed with APIGatewayProxyEvent/APIGatewayProxyResult while deployed via Function URLs; once API Gateway is introduced, event typing remains appropriate but route/query parsing and default path behavior must be explicitly mapped.
- Table key casing mismatch (pk/sk vs PK/SK) will break Dynamo repository access until reconciled.
- Frontend page expects wrapped payloads (`accounts`, `transactions`) and will silently show empty state if backend returns arrays directly.

## Reconciliation Notes
- Added from dossier: explicit route-contract mismatch for sync-transactions naming and shared response helper absence search evidence.
- Added from dossier: async webhook invoke wiring as a protected anchor during gateway migration.
- Conflict resolved: dossier referenced API gateway absence; repo was re-checked and confirmed by search evidence over infra sources.
- Intentionally dropped: broad generic implementation prose from dossier that did not add file-level execution detail.

## Delta Design

### Data / State Changes
Existing:
- API handlers use in-memory repositories for accounts/transactions/sync paths.
- Dynamo repository implementations exist but lack concrete runtime client in these handlers.
- Table construct does not align with repository key attribute casing and GSIs.

Change:
- Add concrete AWS Dynamo repository client implementation and wire API handlers to createDynamoBankingCoreRepositories.
- Align CDK table definition with PK/SK and GSI attributes required by repository queries.
- Remove in-memory repository usage from API handlers participating in frontend sandbox flows.

Why:
- Ensures persistence and realistic cross-invocation behavior needed for frontend sandbox testing.

Risks:
- Misaligned table attributes or missing GSIs can cause runtime query failures.

### Entry Point / Integration Flow
Existing:
- Frontend consumes one base URL with REST-style route paths.
- Backend emits per-lambda Function URLs, not path-routed API gateway endpoints.

Change:
- Add API Gateway construct with explicit route mappings:
  - POST /api/plaid/create-link-token
  - POST /api/plaid/sandbox/public_token/create
  - POST /api/plaid/exchange-token
  - POST /api/plaid/sync-transactions/{itemId}
  - GET /api/accounts
  - GET /api/accounts/{accountId}
  - GET /api/transactions
- Output single API base URL for frontend.
- Remove frontend dependency on individual Lambda Function URL outputs.

Why:
- Gives frontend one stable integration endpoint and route contract.

Risks:
- Route/path parameter mismatches can break existing frontend calls.

### Execution / Control Flow
Existing:
- Webhook ingress invokes sync lambda asynchronously via Lambda invoke.

Change:
- Keep webhook async path unchanged.
- API Gateway route for sync endpoint invokes same sync lambda for frontend-triggered sync.

Why:
- Preserves existing event-driven flow while adding user-triggered test flow.

Risks:
- Duplicate sync invocations if webhook and frontend trigger simultaneously; idempotency should be maintained in sync handler logic.

### User-Facing / Operator-Facing Surface
Existing:
- Frontend expects wrapped response objects and user_id naming conventions.
- Backend returns mixed response shapes and userId query expectations.

Change:
- Introduce shared response utility producing one envelope format for success and errors.
- Normalize query parsing to accept user_id from frontend.
- Standardize error payload shape consumed by PlaidLinkButton and dashboard fetch flows.

Why:
- Reduces UI conditionals and integration bugs during sandbox testing.

Risks:
- Breaking response field names can regress existing client code if not applied consistently.

### External / Operational Surface
Existing:
- CORS headers are manually repeated per handler and per Function URL configuration.

Change:
- Move CORS and route-level HTTP policy to API Gateway configuration.
- Keep local deploy outputs for testing (gateway URL + webhook URL where needed).

Why:
- Centralized HTTP policy and cleaner handler code.

Risks:
- CORS misconfiguration can block browser calls despite healthy lambdas.

## Implementation Blueprint

### Architecture Overview
API Gateway becomes the single frontend-facing ingress for path-routed requests. Existing API lambdas remain business entrypoints, but they are invoked via gateway integrations instead of direct Function URLs. API handlers share a common response/error envelope utility and use Dynamo-backed repositories via a concrete AWS repository client.

Webhook ingress remains separately callable for webhook events and keeps async invocation of the sync lambda using existing permission/environment wiring.

### Key Pseudocode
```typescript
// lib/constructs/api-gateway.ts
create HttpApi or RestApi
for each route in frontend contract:
  add route(method, path, lambdaIntegration)
set CORS for web origin(s)
export api base URL output

// src/lambdas/shared/api-response.ts
export ok(data, meta?) => {
  statusCode: 200,
  headers: sharedHeaders,
  body: JSON.stringify({ success: true, data, meta })
}

export fail(statusCode, code, message, details?) => {
  statusCode,
  headers: sharedHeaders,
  body: JSON.stringify({ success: false, error: { code, message, details } })
}

// src/lambdas/api-accounts-get.ts
const repo = createDynamoBankingCoreRepositories(new AwsDynamoRepositoryClient())
const userId = event.queryStringParameters?.user_id ?? "user-123"
const accountId = event.pathParameters?.accountId
const accounts = await repo.accounts.getAccountsByUser(userId)
if (accountId) return ok({ account: accounts.find((a) => a.accountId === accountId) ?? null })
return ok({ accounts })

// src/lambdas/api-plaid-sync.ts
extract itemId from path params if present
run sync logic (or scaffold behavior) via Dynamo-backed repo
return ok({ synced: true, itemId })
```

### Data Models and Structure
```typescript
// Existing repository source-of-truth
export interface AccountRepository {
  putAccount(account: AccountRecord): Promise<void>;
  getAccountsByUser(userId: string): Promise<AccountRecord[]>;
}

export interface TransactionRepository {
  putTransaction(transaction: TransactionRecord): Promise<void>;
  getTransactionsByUser(userId: string): Promise<TransactionRecord[]>;
}

// Existing frontend call shape expectations
// setAccounts(accountsData.accounts || [])
// setTransactions(transactionsData.transactions || [])
```

### Tasks (in implementation order)
Task 1:
Goal:
- Introduce centralized API Gateway routing that matches existing frontend route paths.
Files:
- MODIFY apps/serverless-backend/lib/banking-core-stack.ts
- CREATE apps/serverless-backend/lib/constructs/api-gateway.ts
- MODIFY apps/serverless-backend/lib/constructs/webhooks.ts
Pattern to copy:
- apps/serverless-backend/lib/constructs/webhooks.ts
Gotchas:
- Keep existing webhook async invoke wiring and permissions intact.
Definition of done:
- Stack outputs one API base URL; all frontend-required routes are registered on gateway.

Task 2:
Goal:
- Make DynamoDB infra consistent with repository expectations.
Files:
- MODIFY apps/serverless-backend/lib/constructs/database.ts
- MODIFY apps/serverless-backend/src/dynamodb/schema.ts (if needed for alignment only)
Pattern to copy:
- apps/serverless-backend/src/dynamodb/schema.ts
Gotchas:
- PK/SK casing and GSI definitions must align with repository query keys.
Definition of done:
- Table definition and repository assumptions use same key names and indexes.

Task 3:
Goal:
- Provide concrete AWS repository client for Dynamo operations.
Files:
- CREATE apps/serverless-backend/src/repositories/aws-dynamo-repository-client.ts
- MODIFY apps/serverless-backend/package.json
Pattern to copy:
- apps/serverless-backend/src/repositories/client.ts
Gotchas:
- client.ts is interface-only; runtime implementation must satisfy all put/get/query/update methods.
Definition of done:
- API handlers can instantiate createDynamoBankingCoreRepositories with concrete client.

Task 4:
Goal:
- Standardize API success/error response envelope and apply across API lambdas.
- Implement concrete account-detail handling for GET /api/accounts/{accountId} using api-accounts-get path-parameter branching.
Files:
- CREATE apps/serverless-backend/src/lambdas/shared/api-response.ts
- MODIFY apps/serverless-backend/src/lambdas/api-accounts-get.ts
- MODIFY apps/serverless-backend/src/lambdas/api-transactions-get.ts
- MODIFY apps/serverless-backend/src/lambdas/api-plaid-create-link-token.ts
- MODIFY apps/serverless-backend/src/lambdas/api-plaid-exchange-token.ts
- MODIFY apps/serverless-backend/src/lambdas/api-plaid-sandbox-create.ts
- MODIFY apps/serverless-backend/src/lambdas/api-plaid-sync.ts
Pattern to copy:
- apps/serverless-backend/src/lambdas/plaid-webhook-ingress.ts (structured validation/error paths)
Gotchas:
- Keep field names needed by frontend (link_token, access_token, item_id) either in data payload or mapped frontend update.
- api-accounts-get must support both list and detail route patterns.
Definition of done:
- All API lambdas return one uniform envelope and consistent error object shape, and account detail route is resolved.

Task 5:
Goal:
- Align frontend client with gateway base URL, route contract, and standardized payload envelope.
- This task remains in-scope because locked decisions require a consistent API envelope and the frontend is the direct contract consumer.
Files:
- MODIFY apps/web/lib/api-client.ts
- MODIFY apps/web/app/page.tsx
Pattern to copy:
- apps/web/components/bank/PlaidLinkButton.tsx
Gotchas:
- query param naming (user_id) and data wrappers must match backend responses.
Definition of done:
- Dashboard and Plaid link flow work against API Gateway URL without route-specific hacks.

## Integration Points
- Data / schema source of truth: apps/serverless-backend/src/dynamodb/schema.ts and apps/serverless-backend/src/repositories/types.ts
- Entry points to extend: apps/serverless-backend/lib/banking-core-stack.ts and apps/serverless-backend/lib/constructs/webhooks.ts
- Validation layer: in-handler validation pattern in apps/serverless-backend/src/lambdas/plaid-webhook-ingress.ts
- Domain / service layer: repository interfaces and factories under apps/serverless-backend/src/repositories
- User-facing / operator-facing surface: apps/web/lib/api-client.ts, apps/web/app/page.tsx, apps/web/components/bank/PlaidLinkButton.tsx
- Shared types / export hubs: repository interfaces/types in apps/serverless-backend/src/repositories/interfaces.ts and apps/serverless-backend/src/repositories/types.ts
- External / operational hooks: webhook-triggered async invoke in apps/serverless-backend/src/lambdas/plaid-webhook-ingress.ts and env wiring in apps/serverless-backend/lib/constructs/webhooks.ts

## Validation
```bash
# Backend compile checks
npm run build --workspace=serverless-backend

# Frontend checks
npm run lint --workspace=web
npm run build --workspace=web

# Local deploy check for route outputs
npm run deploy:local --workspace=serverless-backend
```

### Factuality Checks
- Verified Repo Truths uses Fact / Evidence / Implication for each bullet.
- Negative claims include Search Evidence.
- Verified Repo Truths implication lines remain descriptive of current-state impact.
- Every MODIFY path already exists in repo.

### Manual Checks
- Scenario: create link token from UI through API Gateway base URL.
  Expected: request hits POST /api/plaid/create-link-token and returns standardized success envelope with link token field.
- Scenario: fetch accounts/transactions from dashboard with user_id.
  Expected: data appears in dashboard using wrapped accounts/transactions response.
- Scenario: trigger sync via frontend route and webhook route independently.
  Expected: both paths return consistent envelope; webhook async invoke still succeeds.

## Open Questions
- None

## Final Validation Checklist
- [ ] Backend build passes: npm run build --workspace=serverless-backend
- [ ] Frontend lint/build pass: npm run lint --workspace=web && npm run build --workspace=web
- [ ] API Gateway exposes required frontend routes
- [ ] API lambdas use Dynamo-backed repositories for read/sync flows
- [ ] Response/error envelope is uniform across API lambdas
- [ ] Verified Repo Truths contains only checked facts with evidence
- [ ] Negative claims include search evidence
- [ ] No placeholder/template strings remain

## Deprecated / Removed Code
- Per-lambda frontend-facing Function URL outputs as primary integration surface in apps/serverless-backend/lib/constructs/webhooks.ts
- Ad hoc per-handler response shapes in API lambdas under apps/serverless-backend/src/lambdas/api-*.ts
- In-memory repository construction in API read/sync handlers (accounts/transactions/sync) once Dynamo-backed client is wired
