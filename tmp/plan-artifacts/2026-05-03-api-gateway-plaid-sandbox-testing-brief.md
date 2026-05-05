# Brief: API Gateway Setup for Frontend + Plaid Sandbox

## Problem / Outcome Summary
The frontend currently calls path-based API routes while the serverless backend exposes per-Lambda Function URLs. This creates routing mismatch and inconsistent payload/parameter conventions, making end-to-end sandbox testing difficult. We need a unified API Gateway entrypoint so frontend flows (Plaid Link token creation, token exchange, sync, accounts, transactions) can be tested reliably.

## Who This Matters For
- Developers testing frontend against serverless backend
- Operators deploying and validating LocalStack/AWS serverless flows
- Product iteration on Plaid sandbox onboarding and transaction sync UX

## Locked Decisions
- Introduce API Gateway as the primary frontend-facing API surface.
- Move read/sync data access away from in-memory repositories toward DynamoDB-backed repositories/AWS services for realistic behavior.
- Standardize error handling and response format across all API lambdas (no per-lambda ad hoc response shapes).

## Non-Goals / Must Not Be Optimized Away
- Do not keep the current fragmented endpoint surface as the primary integration contract.
- Do not keep mixed response formats once the gateway path is introduced.
- Do not add backward-compatibility shims unless explicitly requested.

## Success Criteria
- Frontend can hit one API base URL with path routes for Plaid + accounts + transactions.
- Plaid sandbox link-token/exchange/sync flow works through API Gateway routes.
- Account/transaction reads persist via DynamoDB-backed repositories.
- API responses follow one consistent success/error contract across handlers.

## Explicit Constraints
- Plan only; no implementation in this step.
- Keep file-level tasks concrete and aligned with current repo layout.
- Exclude test creation from the plan.