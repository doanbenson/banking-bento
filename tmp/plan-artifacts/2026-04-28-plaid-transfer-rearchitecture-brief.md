# Plaid Transfer and Read Replumbing Brief

## Problem / Outcome Summary
The current serverless backend uses Plaid for webhook ingestion but uses a mocked Lithic provider for money movement. The frontend expects an account/transaction endpoint but there is none in the serverless stack (currently relying on a deprecating Python API). The goal is to fully remove Lithic, switch to Plaid for both account-to-account transfers and read data, and establish a clear unidirectional flow: Plaid webhook → backend sync → datastore update → frontend read.

## Who This Matters For
- End users: who interact with the web frontend to view accounts, transactions, and link new banks.
- Operators/System: single integration point (Plaid) instead of split brain (Lithic + Plaid).

## Locked Decisions
- Remove Lithic entirely (webhooks, providers, models).
- Use Plaid Transfer API for account-to-account transfers in the Step Functions workflow.
- Introduce actual database tables/entities for accounts and transactions in the serverless backend.
- Account and transaction data will be cached in the backend's datastore.
- Update the frontend to read from this serverless backend rather than the legacy Python API.
- Idempotency and Audit models must be preserved.

## Non-Goals
- Migrating the legacy Python API. We will implement fresh lambdas for front-end access.
- Changing the Step Functions orchestration state machine itself (except for lambda names/wiring).

## Success Criteria
- No Lithic references in the codebase.
- Plaid Transfer Provider is injected into `process-transfer-leg` and `compensate-transfer-leg`.
- `BankingCore` table schema or access patterns are updated to include Account and Transaction entities.
- Read lambdas are provisioned (`getAccounts`, `getTransactions`).
- Plaid webhook triggers a sync to DynamoDB.
- Frontend config points to the new serverless backend API.