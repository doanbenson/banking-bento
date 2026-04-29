# PRP Research Dossier: Plaid Transfer Rearchitecture

## 1. Goal and Rationale
Transition the banking backend from Lithic-based transfers to the Plaid Transfer API, and implement caching of Plaid account / transaction data in DynamoDB to optimize frontend read patterns. 

## 2. Codebase Anchors & Analysis

### 2.1 Transfer Providers
* **File:** [apps/serverless-backend/src/providers/lithic-transfer-provider.ts](apps/serverless-backend/src/providers/lithic-transfer-provider.ts#L6-L55)
* **Status:** Slated for deprecation. 
* **Action:** Needs replacement by a `plaid-transfer-provider.ts` which implements a generic `TransferProvider` interface. Our integration currently features mock Lithic actions `createTransfer` and `reverseTransfer` with custom idempotency logic (`Idempotency-Key` headers). This exact shape is required for the state machine integration.

### 2.2 Webhook Ingress
* **File:** [apps/serverless-backend/src/lambdas/lithic-webhook-ingress.ts](apps/serverless-backend/src/lambdas/lithic-webhook-ingress.ts) (implied anchor)
* **Status:** To be replaced or removed.
* **File:** [apps/serverless-backend/src/lambdas/plaid-webhook-ingress.ts](apps/serverless-backend/src/lambdas/plaid-webhook-ingress.ts)
* **Action:** Expand the existing Plaid webhook ingress to support `TRANSFER_EVENTS` in addition to the standard item/sync webhooks.

### 2.3 DynamoDB Schema & Access Patterns
* **File:** [apps/serverless-backend/src/dynamodb/schema.ts](apps/serverless-backend/src/dynamodb/schema.ts#L1-L30) (Table Definition)
* **File:** [apps/serverless-backend/src/dynamodb/keys.ts](apps/serverless-backend/src/dynamodb/keys.ts)
* **Action:** DynamoDB table (`BANKING_CORE_TABLE`) with its base `PK`, `SK` and GSIs (`GSI1`, `GSI2`) handles current persistence. We must extend `keys.ts` with new key builders for Plaid Accounts and Plaid Transactions (e.g., `ACC#<plaid_id>`, `TXN#<plaid_id>`). 

## 3. Patterns to Reuse

* **Idempotency Engine**: Ensure Plaid API transfers reuse `inbound-lock-repository.ts` for inbound API idempotency. Webhook processing must rely on the existing idempotency patterns driven by Event IDs to prevent duplicate transaction syncing or transfer leg progression.
* **Audit & Error Handling**: Plaid transfers must integrate with the existing execution context (`execution-context.ts`) and metrics (`metrics-alarms.ts`) exactly as Lithic did. Keep `ProviderTerminalError` semantics to appropriately halt Step Functions state machines. 

## 4. Suggested Implementation Shape

### 4.1 Plaid Datastore Entities (Caching)
Cache the Plaid accounts and transactions as native DynamoDB entities for rapid frontend consumption:
1.  **Account Entity:**
    *   `PK`: `USER#<user_id>`
    *   `SK`: `ACC#<plaid_account_id>`
    *   Store: balances, mask, name, subtype.
2.  **Transaction Entity:**
    *   `PK`: `ACC#<plaid_account_id>`
    *   `SK`: `TXN#<date>#<plaid_transaction_id>`
    *   `GSI1PK`: `USER#<user_id>`, `GSI1SK`: `TXN#<date>` (Allows cross-account chronological queries)

### 4.2 Read Flows
* Eliminate direct real-time synchronous calls to Plaid from the Next.js frontend if possible.
* The frontend `/api/accounts` API should execute queries against DynamoDB GSIs rather than passing through to Plaid, fetching the pre-cached account and transaction lines populated heavily async via the `/sync` webhook events in the background.

## 5. Gotchas & Risks
* **Webhook Sequencing:** Plaid webhook events are not strictly guaranteed to arrive in absolute chronological order. The `sync_updates_available` processing must handle out-of-order execution gracefully by checking the latest cursor.
* **Step Function State changes:** State machines referencing `Lithic` will need their definitions (`split-transfer.asl.json`) adjusted for any shape discrepancy in payloads when switching the lambda resources.
* **Reversals/Compensations:** Plaid transfers rely heavily on specific ACH mechanics. Plaid doesn't natively "reverse" in the exact same programmatic way Lithic manages voids/returns. Application-level balancing or "Refund" transfers are required to execute compensations.