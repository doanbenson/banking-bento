# Implementation Plan: Plaid Transfer Rearchitecture

## Summary
This plan covers the replacement of the existing Lithic transfer integration with the Plaid Transfer API and introduces a new read-path architecture. It outlines removing Lithic webhooks and transfer providers, creating Plaid-specific transfer providers for the Step Functions orchestration, adding DynamoDB entities for `Account` and `Transaction` data, and exposing these via new AWS API Gateway/Lambda endpoints so the Next.js frontend can read directly from the serverless backend instead of the deprecating Python API.

## Intent / Why
The current architecture splits money movement (mocked Lithic) and webhook ingestion (Plaid and Lithic). To streamline operations, ensure correct auditability, and provide a secure, cost-effective read path for the frontend (which currently targets a separate backend), we must unify around Plaid. This establishes a robust "webhook → cache → read" flow.

## Source Artifacts
- **Brief**: `tmp/plan-artifacts/2026-04-28-plaid-transfer-rearchitecture-brief.md`
- **Research Dossier**: `tmp/plan-artifacts/2026-04-28-plaid-transfer-rearchitecture-research-dossier.md`

## Verified Repo Truths

- **Fact:** Lithic is currently used as an inbound event source and outbound transfer provider.
  - **Evidence:** `apps/serverless-backend/src/lambdas/lithic-webhook-ingress.ts:41`
  - **Implication:** The Lithic ingress lambda and its CDK bindings must be removed.
- **Fact:** The transfer leg processing uses a Lithic Transfer Provider interface.
  - **Evidence:** `apps/serverless-backend/src/lambdas/process-transfer-leg.ts:20-22`
  - **Implication:** This provider must be swapped with a `PlaidTransferProvider`.
- **Fact:** The frontend expects Plaid endpoints (`exchange-token`, `sync-transactions`) and read endpoints (`accounts`, `transactions`) to exist.
  - **Evidence:** `apps/web/lib/api-client.ts:11-57`
  - **Implication:** The serverless backend needs to implement these endpoints via Lambda+API Gateway or Function URLs.
- **Fact:** The database is a single-table DynamoDB design with predefined key prefixes like `USER#`, `EVENT#`.
  - **Evidence:** `apps/serverless-backend/src/dynamodb/keys.ts:3`
  - **Implication:** We must add `ACCOUNT#` and `TXN#` prefixes and their respective access patterns.

## Locked Decisions
- Remove Lithic entirely (webhooks, providers, models).
- Use Plaid Transfer API for account-to-account transfers.
- Introduce actual database tables/entities for accounts and transactions in the serverless backend.
- Account and transaction data will be cached in the backend's datastore (DynamoDB).
- Idempotency and Audit models must be preserved.

## Known Mismatches / Assumptions
- Plaid Transfer authorization (Sandbox vs Production) is assumed to be handled within the environment variables.
- Step Functions state machine logic is assumed to be generic enough that no JSON changes to `split-transfer.asl.json` are strictly required beyond possible task naming updates or payload adjustments for the compensation model.

## Critical Codebase Anchors
- `apps/serverless-backend/src/lambdas/process-transfer-leg.ts`
- `apps/serverless-backend/src/lambdas/compensate-transfer-leg.ts`
- `apps/serverless-backend/src/dynamodb/schema.ts`
- `apps/serverless-backend/src/dynamodb/keys.ts`
- `apps/web/lib/api-client.ts`

## Files Being Changed
```
apps/serverless-backend/
├── lib/
│   └── constructs/
│       ├── webhooks.ts (MODIFIED: Remove Lithic ingress, add Plaid APIs)
│       └── database.ts (MODIFIED: Expose permissions for new lambdas)
├── src/
│   ├── contracts/
│   │   └── events.ts (MODIFIED: Remove 'lithic' source)
│   ├── dynamodb/
│   │   ├── keys.ts (MODIFIED: Add ACCOUNT variables)
│   │   └── schema.ts (MODIFIED: Document GSI mapping for accounts/txns)
│   ├── lambdas/
│   │   ├── lithic-webhook-ingress.ts (DELETED)
│   │   ├── process-transfer-leg.ts (MODIFIED: Switch to Plaid provider)
│   │   ├── compensate-transfer-leg.ts (MODIFIED: Switch to Plaid provider)
│   │   ├── api-accounts-get.ts (NEW)
│   │   ├── api-transactions-get.ts (NEW)
│   │   ├── api-plaid-exchange-token.ts (NEW)
│   │   └── api-plaid-sync.ts (NEW)
│   ├── providers/
│   │   ├── lithic-transfer-provider.ts (DELETED)
│   │   └── plaid-transfer-provider.ts (NEW)
│   └── repositories/
│       ├── types.ts (MODIFIED: Remove 'lithic' source, add account/txn types)
│       ├── interfaces.ts (MODIFIED: Add Account/Txn repository methods)
│       └── dynamodb-banking-core-repositories.ts (MODIFIED)
apps/web/
└── lib/
    └── api-client.ts (MODIFIED: adjust paths if necessary, though base URL config handles most of it)
```

## Reconciliation Notes
- Reconciled the fact that Lithic compensation maps exactly to Plaid's transfer cancel/refund operations by defining a matching PlaidTransferProvider interface.

## Delta Design
- **Data/State**: Added `ACCOUNT#` and `TXN#` patterns to DynamoDB. Added to API endpoints so the frontend reads cached data without hitting Plaid directly.
- **Execution**: The `process-transfer-leg` now relies on a `plaid-transfer-provider.ts` which uses the Plaid Node SDK instead of the mocked Lithic behavior.

## Tasks
1. **Remove Lithic code**: Delete `lithic-webhook-ingress.ts` and `lithic-transfer-provider.ts`. Remove CDK configurations linking them.
2. **Update Data Models**: Add Account and Transaction entity representations to `types.ts`, `keys.ts`, and `interfaces.ts`. Implement them in `dynamodb-banking-core-repositories.ts`.
3. **Implement Plaid Transfer Provider**: Create `plaid-transfer-provider.ts` matching the interfaces expected by `process-transfer-leg` but executing Plaid `transfer/create` and `transfer/cancel`.
4. **Implement API Lambdas**: Create `api-accounts-get.ts`, `api-transactions-get.ts`, and token exchange lambdas. Add them to CDK stack.
5. **Wire Plaid Webhooks to Cache**: Update Plaid webhook ingress to handle `SYNC_UPDATES_AVAILABLE` by triggering the new `api-plaid-sync.ts` logic to hydrate DynamoDB.

## Validation
- Validate no Lithic strings remain across the monorepo (`grep -ri lithic .`).
- Ensure Step Functions deploy successfully via CDK synth.
- Verify API Gateway or Function URLs for new read endpoints are successfully outputted during CDK deploy.

## Open Questions
- Do we need an intermediate queue (SQS) between the Plaid Webhook and the DynamoDB sync process if burst rates exceed lambda concurrency?

## Deprecated Code
- Lithic Webhook Ingress
- Lithic Transfer Provider