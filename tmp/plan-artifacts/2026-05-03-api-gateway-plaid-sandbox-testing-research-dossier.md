# PRP Research Dossier: API Gateway setup so frontend can test serverless backend with Plaid sandbox

## Feature intent (research scope only)
Enable a unified frontend-facing API surface for serverless Plaid sandbox testing, while aligning persistence toward AWS/DynamoDB-backed repositories and normalizing API response/error shape across API lambdas.

## Critical codebase anchors
- Current serverless HTTP surface is Lambda Function URLs, not API Gateway. Function URL creation is centralized in `apps/serverless-backend/lib/constructs/webhooks.ts:24-43`, with one URL per lambda (`apps/serverless-backend/lib/constructs/webhooks.ts:47-52`).
- Webhook ingress triggers async Plaid sync lambda by function name env wiring (`apps/serverless-backend/lib/constructs/webhooks.ts:54-55`) and invoke path (`apps/serverless-backend/src/lambdas/plaid-webhook-ingress.ts:113-120`).
- Frontend assumes one base URL and path-based REST endpoints via axios (`apps/web/lib/api-client.ts:3-6`, `apps/web/lib/api-client.ts:15-35`, `apps/web/lib/api-client.ts:39-60`).
- Plaid Link UI depends on `/api/plaid/create-link-token` and `/api/plaid/exchange-token` response bodies and `error` field conventions (`apps/web/components/bank/PlaidLinkButton.tsx:37-45`, `apps/web/components/bank/PlaidLinkButton.tsx:57-64`).
- API lambdas currently return ad hoc JSON bodies and direct CORS headers in each file (`apps/serverless-backend/src/lambdas/api-accounts-get.ts:11-21`, `apps/serverless-backend/src/lambdas/api-transactions-get.ts:11-21`, `apps/serverless-backend/src/lambdas/api-plaid-create-link-token.ts:4-8`, `apps/serverless-backend/src/lambdas/api-plaid-exchange-token.ts:4-8`, `apps/serverless-backend/src/lambdas/api-plaid-sync.ts:34-38`).
- Webhook ingress uses a different response contract (`accepted/status/...`) and custom request/response interfaces, not `APIGatewayProxyResult` (`apps/serverless-backend/src/lambdas/plaid-webhook-ingress.ts:15-23`, `apps/serverless-backend/src/lambdas/plaid-webhook-ingress.ts:87-94`, `apps/serverless-backend/src/lambdas/plaid-webhook-ingress.ts:162-190`).

## Reuse patterns to leverage
- Existing lambda factory pattern (`createApiLambda`) already centralizes env + table grant + URL output and is the natural place to attach shared HTTP integration concerns (`apps/serverless-backend/lib/constructs/webhooks.ts:36-45`).
- DynamoDB repository abstraction is already implemented and export-ready (`apps/serverless-backend/src/repositories/client.ts:32-39`, `apps/serverless-backend/src/repositories/dynamodb-banking-core-repositories.ts:532-541`).
- Canonical key/table model for BankingCore exists and should remain source of truth (`apps/serverless-backend/src/dynamodb/keys.ts:1-38`).
- Inbound idempotency has both in-memory and Dynamo conditional-put implementations, with in-memory currently default (`apps/serverless-backend/src/idempotency/inbound-lock-repository.ts:32-64`, `apps/serverless-backend/src/idempotency/inbound-lock-repository.ts:80-127`, `apps/serverless-backend/src/idempotency/inbound-lock-repository.ts:130-133`).

## Gotchas and mismatches
- Persistence drift: API read/sync lambdas still instantiate in-memory repositories (`apps/serverless-backend/src/lambdas/api-accounts-get.ts:2-4`, `apps/serverless-backend/src/lambdas/api-transactions-get.ts:2-4`, `apps/serverless-backend/src/lambdas/api-plaid-sync.ts:2-4`).
- Workflow lambdas also default to in-memory dependencies unless injected (`apps/serverless-backend/src/lambdas/process-transfer-leg.ts:48-56`, `apps/serverless-backend/src/lambdas/compensate-transfer-leg.ts:48-56`).
- Frontend query param name differs from backend expectation: frontend sends `user_id` (`apps/web/lib/api-client.ts:41-43`, `apps/web/lib/api-client.ts:56-57`) while handlers read `userId` (`apps/serverless-backend/src/lambdas/api-accounts-get.ts:8`, `apps/serverless-backend/src/lambdas/api-transactions-get.ts:8`).
- Frontend defines `/api/plaid/sync-transactions/:itemId` (`apps/web/lib/api-client.ts:32-34`), but backend lambda naming and current wiring indicate `api-plaid-sync.ts` without an explicit matching route contract (`apps/serverless-backend/lib/constructs/webhooks.ts:52`, `apps/serverless-backend/src/lambdas/api-plaid-sync.ts:1-39`).
- `api-plaid-sandbox-create.ts` imports Dynamo factory/client but currently does not use them, indicating partial migration state (`apps/serverless-backend/src/lambdas/api-plaid-sandbox-create.ts:2-3`, `apps/serverless-backend/src/lambdas/api-plaid-sandbox-create.ts:5-10`).

## Implementation shape (non-plan)
- Introduce one unified HTTP front door (API Gateway) mapping stable frontend routes already used by `apps/web/lib/api-client.ts:15-35` and `apps/web/lib/api-client.ts:39-60` to existing API lambdas.
- Keep webhook ingress async sync-trigger flow intact (`apps/serverless-backend/src/lambdas/plaid-webhook-ingress.ts:113-120`) while exposing frontend testable paths through the same API front door.
- Replace in-memory repo instantiation in API and workflow lambdas with Dynamo-backed repository construction via existing abstraction (`apps/serverless-backend/src/repositories/dynamodb-banking-core-repositories.ts:532-541`, `apps/serverless-backend/src/lambdas/api-accounts-get.ts:2-4`, `apps/serverless-backend/src/lambdas/api-transactions-get.ts:2-4`, `apps/serverless-backend/src/lambdas/api-plaid-sync.ts:2-4`).
- Normalize API success/error envelopes and headers so frontend error handling has one contract across Plaid/accounts/transactions endpoints (currently divergent per `apps/serverless-backend/src/lambdas/api-accounts-get.ts:11-21` vs `apps/serverless-backend/src/lambdas/plaid-webhook-ingress.ts:87-94` and `apps/serverless-backend/src/lambdas/plaid-webhook-ingress.ts:162-190`).

## Search evidence for absence claims
- Absence claim: no API Gateway constructs currently declared in infra TS sources.
- Evidence: search query `aws-apigateway|aws-apigatewayv2|HttpApi|RestApi|CfnApi` over `apps/serverless-backend/lib/**/*.ts` returned `No matches found`.

- Absence claim: no shared response formatter utility currently present in backend TS sources.
- Evidence: search query `formatResponse|successResponse|errorResponse|responseBuilder|apiResponse` over `apps/serverless-backend/src/**/*.ts` returned `No matches found`.

- Absence claim: backend source has no existing `sync-transactions` route string matching frontend path name.
- Evidence: search query `sync-transactions` over `apps/serverless-backend/src/**/*.ts` returned `No matches found`.

## High-signal constraints for execution
- Preserve frontend path contract semantics already consumed by UI (`apps/web/lib/api-client.ts:15-35` and `apps/web/lib/api-client.ts:39-60`) to avoid client churn during sandbox testing.
- Keep compatibility with current Plaid Link success/error expectations (`apps/web/components/bank/PlaidLinkButton.tsx:37-45`, `apps/web/components/bank/PlaidLinkButton.tsx:57-64`).
- Maintain idempotency and webhook safety behavior while changing HTTP ingress shape (`apps/serverless-backend/src/lambdas/plaid-webhook-ingress.ts:145-190`, `apps/serverless-backend/src/idempotency/inbound-lock-repository.ts:80-127`).
