# Banking Bento - Architecture Exploration

**Date:** April 28, 2026

## Executive Summary

This document provides a medium-level exploration of the serverless backend and web frontend architecture, focusing on Lambda functions, Plaid integration patterns, API endpoints, and communication flows with external services.

---

## Part 1: Serverless Backend Architecture

### 1.1 Infrastructure Overview

**Stack Components:**
- **AWS CDK** - Infrastructure as Code (TypeScript)
- **AWS Step Functions** - Orchestrates transfer workflows
- **AWS Lambda** - Event processing and transfer operations
- **AWS DynamoDB** - Single-table data store with GSI support
- **Function URLs** - Webhook ingestion endpoints

**Key Construct Structure:**
```
BankingCoreStack
├── BankingDatabase (DynamoDB Table)
├── TransferWorkflow (Step Function + Processing Lambdas)
└── BankingWebhooks (Webhook Ingress Lambdas)
```

### 1.2 Lambda Functions

#### **1. Plaid Webhook Ingress** (`plaid-webhook-ingress.ts`)

**Purpose:** Receives and validates webhook events from Plaid

**Event Signature:**
```typescript
interface PlaidDepositPayload {
  webhook_id: string;
  user_id: string;
  account_id: string;
  amount_minor: number;      // Smallest currency unit
  currency: string;          // 3-letter ISO code (e.g., "USD")
  posted_at: string;         // ISO timestamp
}
```

**Responsibilities:**
- Validates incoming webhook payload structure
- Extracts correlation IDs from request headers (`x-correlation-id`, `x-request-id`, `x-amzn-trace-id`)
- Acquires idempotency lock to prevent duplicate processing
- Converts Plaid event to `DepositReceivedEvent` contract
- Triggers Step Function state machine for transfer orchestration
- Implements structured logging and metrics

**Exposed Via:** Lambda Function URL (public, no authentication)

---

#### **2. Lithic Webhook Ingress** (`lithic-webhook-ingress.ts`)

**Purpose:** Receives and validates webhook events from Lithic (alternative payment provider)

**Event Signature:**
```typescript
interface LithicDepositPayload {
  event_id: string;
  user_id: string;
  account_id: string;
  amount_minor: number;
  currency: string;
  posted_at: string;
}
```

**Responsibilities:**
- Same validation and idempotency logic as Plaid
- Converts Lithic event to `DepositReceivedEvent` contract
- Shared processing pipeline with Plaid

**Exposed Via:** Lambda Function URL (public, no authentication)

---

#### **3. Process Transfer Leg** (`process-transfer-leg.ts`)

**Purpose:** Executes a single transfer operation as part of a split transfer workflow

**Input Contract:**
```typescript
interface ProcessTransferLegInput {
  executionId: string;
  correlationId?: string;
  leg: TransferLegPlan;
  sourceAccountId: string;
  currency: string;
}
```

**Output Contract:**
```typescript
interface ProcessTransferLegResult {
  executionId: string;
  legId: string;
  status: "SUCCEEDED" | "FAILED";
  providerTransferId?: string;
  reason?: string;
  transferIdempotencyKey?: string;
  correlationId: string;
}
```

**Responsibilities:**
- Acquires idempotency lock using transfer ID as key
- Validates transfer leg amount (must be positive)
- Calls Lithic provider to create transfer
- Stores execution context and audit trail
- Implements retry logic (4 attempts, 2s exponential backoff for transient errors)
- Propagates correlation ID through execution chain

**Error Handling:**
- **Transient Errors** (retried): Service exceptions, timeouts, provider transient errors
- **Terminal Errors** (fail fast): Invalid amounts, missing provider IDs

---

#### **4. Compensate Transfer Leg** (`compensate-transfer-leg.ts`)

**Purpose:** Reverses a successfully executed transfer in case of failure

**Input Contract:**
```typescript
interface CompensateTransferLegInput {
  executionId: string;
  correlationId?: string;
  legId: string;
  providerTransferId: string;
  reason: string;
}
```

**Output Contract:**
```typescript
interface CompensateTransferLegResult {
  executionId: string;
  legId: string;
  status: "COMPENSATED" | "MANUAL_REVIEW_REQUIRED";
  compensationIdempotencyKey?: string;
  providerCompensationId?: string;
  reason?: string;
  correlationId: string;
}
```

**Responsibilities:**
- Reverses transfers via Lithic provider
- Implements idempotency for compensation operations
- Flags failures requiring manual review
- Logs compensation for audit trail

**Invoked By:** Step Function when transfer processing fails

---

### 1.3 Transfer Orchestration - Split Transfer State Machine

**Definition:** `state-machines/split-transfer.asl.json`

**Workflow Stages:**

1. **Validate Webhook & Acquire Idempotency** → Ensures single processing
2. **Load User Rules** → Retrieves split rules for transfer allocation (TBD: not yet in Lambda list)
3. **Compute Leg Plan** → Splits deposit across destination accounts per rules (TBD: not yet in Lambda list)
4. **Persist Execution & Legs** → Stores execution context to DynamoDB (TBD: not yet in Lambda list)
5. **Process Legs** (Map/Parallel)
   - Processes up to 4 transfer legs concurrently
   - Each leg invokes `ProcessTransferLeg` Lambda
   - Retry policy: 4 attempts for transient errors
6. **Evaluate Aggregate Outcome** → Determines overall success/failure
7. **Compensate Succeeded Legs** (if any failed)
   - Invokes `CompensateTransferLeg` for each succeeded leg
   - Retry policy: 3 attempts for compensation errors
8. **Finalize Execution** → Marks execution as succeeded or failed
9. **Notify** → Sends notifications based on final state

**Concurrency:** Max 4 parallel transfers

**Idempotency:** Scope-based with keys for:
- Inbound webhooks (prevents duplicate triggers)
- Transfer execution (prevents duplicate payment processing)
- Compensation operations (prevents duplicate reversals)

---

### 1.4 DynamoDB Schema

**Table Name:** `banking-core-table`

**Billing Mode:** Pay-per-request

**Key Design:**
- **Primary Key:** `PK` (partition) + `SK` (sort)
- **GSI1:** `GSI1PK` + `GSI1SK` (user/rule queries)
- **GSI2:** `GSI2PK` + `GSI2SK` (event/execution queries)

**All attributes are strings (single-table design)**

**Record Types Stored:**
- **User Profiles** - User metadata and settings
- **Split Rules** - User's transfer allocation rules
- **Events** - Webhook events (Plaid, Lithic)
- **Executions** - Transfer workflow execution summaries
- **Transfer Legs** - Individual leg status and provider IDs
- **Idempotency Records** - Idempotency locks and response caches
- **Audit Records** - Complete audit trail of operations

---

### 1.5 External Service Integration

#### **Lithic Transfer Provider**

**Interface:**
```typescript
interface LithicTransferProvider {
  createTransfer(input: CreateLithicTransferInput): Promise<{ providerTransferId: string }>;
  reverseTransfer(input: ReverseLithicTransferInput): Promise<{ providerCompensationId: string }>;
}
```

**Current Implementation:** `MockLithicTransferProvider` (deterministic mock)

**Idempotency:** Uses `Idempotency-Key` header for API idempotency

**Deterministic ID Generation:**
```
lithic-transfer-{sha256(executionId|legId|sourceAccountId|destinationAccountId|amount|currency|idempotencyKey).slice(0, 16)}
lithic-reversal-{sha256(executionId|legId|providerTransferId|reason|idempotencyKey).slice(0, 16)}
```

**Error Types:**
- `ProviderTransientError` - Retryable (network, timeouts)
- `ProviderTerminalError` - Not retryable (validation, permissions)

#### **Plaid**

**Plaid Webhook Event Types:**
- `DEPOSIT_RECEIVED` - Triggered when funds are received on linked bank account

**Payload Validation:**
- Checks all required fields present
- Validates amount is positive integer
- Validates currency is 3-letter ISO code
- Validates timestamp is valid ISO 8601 format

**No Direct API Calls from Backend** - Webhooks are ingestion only

---

### 1.6 Observability & Monitoring

**Execution Context Propagation:**
```typescript
interface ExecutionContext {
  executionId?: string;
  correlationId: string;
}
```

**Correlation ID Sources (in priority order):**
1. Explicit header: `x-correlation-id`
2. AWS Trace ID: `x-amzn-trace-id`
3. Request ID: `x-request-id`
4. Fall back to execution ID or UUID

**Structured Logging:**
- Service: `serverless-backend`
- Component: Function name (e.g., `process-transfer-leg`)
- Includes correlation ID for tracing

**Metrics & Alarms:** (Defined but implementation in `metrics-alarms.ts`)

---

### 1.7 Error Handling Strategy

**Transient vs Terminal Errors:**

| Error Type | Examples | Handling |
|------------|----------|----------|
| **Transient** | Network timeouts, service unavailable, Lambda cold starts | Retry with exponential backoff |
| **Terminal** | Invalid input, validation failure, authentication | Fail immediately |

**Retry Policies:**
- **Transfer Processing:** 4 attempts, 2s base interval, 2x backoff
- **Compensation:** 3 attempts, 2s base interval, 2x backoff

---

## Part 2: Web Frontend Architecture

### 2.1 Technology Stack

**Framework:** Next.js 16.1.6 (React 19)
**State Management:** React hooks + component state
**HTTP Client:** Axios
**Form Library:** React Hook Form + Zod validation
**UI Components:** Shadcn/UI (Radix UI primitives + Tailwind)
**Plaid Integration:** `react-plaid-link` (v4.1.1)

**Package Dependencies:**
```json
{
  "next": "^16.1.6",
  "react": "19.2.3",
  "axios": "^1.13.2",
  "react-plaid-link": "^4.1.1",
  "react-hook-form": "^7.69.0",
  "zod": "^4.2.1"
}
```

---

### 2.2 API Client Configuration

**Location:** `lib/api-client.ts`

**Base Configuration:**
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

**Environment Variable:**
- `NEXT_PUBLIC_API_URL` - Backend URL (public, can be set at build time)
- Defaults to `http://localhost:5000` for local development

---

### 2.3 Plaid API Integration

**Plaid Link Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Component Mounts → Fetch Link Token                       │
│    GET /api/plaid/create-link-token { user_id }             │
│    → Response: { link_token: "link-..." }                    │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 2. User Opens Plaid Link Modal                              │
│    React Plaid Link Component                               │
│    → User authenticates with bank                           │
│    → Plaid returns public_token                             │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 3. Exchange Public Token for Access Token                    │
│    POST /api/plaid/exchange-token                           │
│    { public_token, user_id }                                │
│    → Response: { access_token, item_id, ... }              │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 4. Sync Transactions (Optional)                             │
│    POST /api/plaid/sync-transactions/:itemId                │
│    → Pulls transactions into backend                        │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ 5. Dashboard Refreshes                                       │
│    GET /api/accounts                                        │
│    GET /api/transactions                                    │
└─────────────────────────────────────────────────────────────┘
```

**API Methods:**

```typescript
export const plaidApi = {
  // 1. Create link token for Plaid Link modal
  createLinkToken: async (userId: string = 'user-sandbox') => {
    POST /api/plaid/create-link-token
    { user_id: userId }
    ↓
    { link_token: "link-..." }
  },

  // 2. Create sandbox public token (testing only)
  create_sandbox_public_token: async (userId: string = 'user-sandbox') => {
    POST /api/plaid/sandbox/public_token/create
    { user_id: userId }
    ↓
    { public_token: "public-sandbox-..." }
  },

  // 3. Exchange public token for access token
  exchangePublicToken: async (publicToken: string, userId: string = 'user-sandbox') => {
    POST /api/plaid/exchange-token
    { public_token: publicToken, user_id: userId }
    ↓
    { access_token: "access-...", item_id: "item-...", ... }
  },

  // 4. Trigger transaction sync
  syncTransactions: async (itemId: string) => {
    POST /api/plaid/sync-transactions/:itemId
    ↓
    { transactions: [...], cursor: "..." }
  },
};
```

**Plaid Link Component** (`components/bank/PlaidLinkButton.tsx`):

```typescript
interface PlaidLinkButtonProps {
  onSuccess?: (data: PlaidLinkSuccessData) => void;
  onError?: (error: unknown) => void;
  userId?: string;          // Default: 'user-sandbox'
  buttonText?: string;       // Default: 'Link Bank Account'
  variant?: ButtonVariant;   // Default: 'default'
}

// Flow:
// 1. Fetch link token on mount → usePlaidLink hook
// 2. User completes Plaid Link flow → publicToken returned
// 3. Exchange token via POST /api/plaid/exchange-token
// 4. Call onSuccess callback with result
// 5. Parent component refreshes account/transaction data
```

---

### 2.4 Accounts API Integration

**Endpoints:**

```typescript
export const accountsApi = {
  // Get all accounts for user
  getAll: async (userId?: string) => {
    GET /api/accounts?user_id=:userId
    ↓
    { accounts: [{ account_id, name, mask, type, subtype, balance: {...} }, ...] }
  },

  // Get specific account by ID
  getById: async (accountId: string) => {
    GET /api/accounts/:accountId
    ↓
    { account_id, name, mask, type, subtype, balance: {...} }
  },
};
```

**Account Data Model:**

```typescript
interface BankAccount {
  account_id: string;
  name: string;
  mask?: string;                    // Last 4 digits
  type: string;                     // 'depository', 'credit', 'loan', 'investment'
  subtype: string;                  // 'checking', 'savings', etc.
  balance: {
    available: number | null;
    current: number | null;
    limit: number | null;
  };
}
```

**Displayed Via:** `AccountCard` component with color-coded type badges

---

### 2.5 Transactions API Integration

**Endpoints:**

```typescript
export const transactionsApi = {
  // Get all transactions, optionally filtered
  getAll: async (userId?: string, accountId?: string) => {
    GET /api/transactions?user_id=:userId&account_id=:accountId
    ↓
    { transactions: [{ transaction_id, account_id, amount, date, name, merchant_name, category, pending }, ...] }
  },
};
```

**Transaction Data Model:**

```typescript
interface Transaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;                     // YYYY-MM-DD format
  name: string;                     // Transaction name
  merchant_name?: string;
  category: string[];               // E.g., ['Food and Drink', 'Restaurants']
  pending: boolean;
}
```

**Displayed Via:** `TransactionList` component, filterable by account

---

### 2.6 Dashboard Flow

**Page:** `app/page.tsx`

**Features:**
1. **Account Display**
   - Shows all linked accounts as cards
   - Color-coded by account type
   - Displays available/current/limit balance
   - Clickable to filter transactions

2. **Plaid Link Integration**
   - "Link Bank Account" button
   - Opens Plaid Link flow
   - Auto-refreshes data on success

3. **Transactions Display**
   - Lists all transactions
   - Filterable by selected account
   - Shows transaction date, name, amount, category

4. **Summary Stats**
   - Total balance calculation
   - Account count

**Data Loading:**
```typescript
useEffect(() => {
  fetchData();  // Runs on mount
}, []);

const fetchData = async () => {
  const [accountsData, transactionsData] = await Promise.all([
    accountsApi.getAll(),
    transactionsApi.getAll(),
  ]);
  // Update state
};
```

---

### 2.7 Current Backend Expectations

**The web frontend expects a backend API at:**

```
Base URL: http://localhost:5000 (configurable via NEXT_PUBLIC_API_URL)

Required Endpoints:
POST   /api/plaid/create-link-token
POST   /api/plaid/exchange-token
POST   /api/plaid/sandbox/public_token/create
POST   /api/plaid/sync-transactions/:itemId
GET    /api/accounts
GET    /api/accounts/:accountId
GET    /api/transactions
```

**This backend does NOT exist in the serverless backend architecture** - the old Python API (deprecating) likely implements these.

---

## Part 3: Integration Patterns & Data Flow

### 3.1 Complete Deposit Flow (Plaid)

```
PLAID (External)
    │
    ├─→ POST https://webhook-url (Lambda Function URL)
    │   Payload: { webhook_id, user_id, account_id, amount_minor, currency, posted_at }
    │
    └─→ PlaidWebhookIngress Lambda
        │
        ├─ Validate payload structure & currency format
        ├─ Extract correlation ID from headers
        ├─ Build idempotency key from webhook_id
        ├─ Acquire inbound idempotency lock (DynamoDB)
        │  └─ If already processed: return early
        ├─ Convert to DepositReceivedEvent
        │
        └─ Start Step Function Execution
            │
            ├─ State: ValidateWebhookAndAcquireInboundIdempotency
            ├─ State: LoadUserRules
            ├─ State: ComputeLegPlan
            ├─ State: PersistExecutionAndLegs → DynamoDB
            │
            ├─ State: ProcessLegs (Parallel, Max 4)
            │   └─ ProcessTransferLeg Lambda (per leg)
            │       ├─ Acquire transfer idempotency lock
            │       ├─ Call Lithic.createTransfer()
            │       ├─ Update leg status: SUCCEEDED/FAILED
            │       ├─ Store audit record
            │       └─ Return: { providerTransferId, status }
            │
            ├─ State: EvaluateAggregateOutcome
            │
            ├─ If ALL succeeded:
            │   └─ MarkExecutionSucceeded → DynamoDB
            │
            └─ If ANY failed:
                ├─ CompensateSucceededLegs (Parallel)
                │   └─ CompensateTransferLeg Lambda (per succeeded leg)
                │       ├─ Call Lithic.reverseTransfer()
                │       ├─ Store compensation ID
                │       └─ Return: { status: COMPENSATED|MANUAL_REVIEW_REQUIRED }
                │
                └─ FinalizeFailedExecutionAndNotify
                    └─ Mark execution as FAILED_COMPENSATED or FAILED_COMPENSATION_REQUIRED_MANUAL
```

### 3.2 Execution Context Flow

```
HTTP Request Headers
    ├─ x-correlation-id (preferred)
    ├─ x-amzn-trace-id (AWS default)
    └─ x-request-id (fallback)
        │
        └─→ PlaidWebhookIngress
            └─→ createExecutionContext()
                └─ Stores in ExecutionContext { executionId, correlationId }
                    │
                    └─ Propagates through entire workflow
                       ├─ Step Function passes to all Lambda invocations
                       ├─ ProcessTransferLeg includes in Lithic request
                       ├─ CompensateTransferLeg includes in compensation request
                       └─ All logs include correlationId for tracing
```

### 3.3 Idempotency Levels

```
Level 1: Inbound Webhook Idempotency
├─ Scope: INBOUND_WEBHOOK
├─ Key: Hash of (source, webhook_id)
└─ Protects: Against Plaid/Lithic retry storms

Level 2: Transfer Execution Idempotency
├─ Scope: TRANSFER_EXECUTION
├─ Key: Hash of (executionId, legId, ...)
└─ Protects: Against Step Function retries causing duplicate charges

Level 3: Compensation Idempotency
├─ Scope: COMPENSATION
├─ Key: Hash of (executionId, legId, providerTransferId, ...)
└─ Protects: Against duplicate reversals
```

---

## Part 4: Architecture Gaps & Questions

### Missing Lambda Functions
The state machine references these Lambda functions that are not yet in the codebase:
1. **ValidateWebhookLambda** - Webhook payload validation
2. **LoadRulesLambda** - Load user's split rules
3. **ComputeLegPlanLambda** - Compute transfer legs based on rules
4. **PersistExecutionLambda** - Store execution and legs to DynamoDB
5. **EvaluateOutcomeLambda** - Aggregate results and determine success/failure
6. **FinalizeExecutionLambda** - Finalize execution and trigger notifications

### Current Backend API Gap
The web frontend expects REST endpoints for:
- Plaid token creation and exchange
- Account list/detail retrieval
- Transaction list retrieval

These are **NOT** in the serverless backend - they must be in the deprecating Python API.

### Lithic Provider
The Lithic provider is currently **mocked** - needs real API implementation.

### Webhook Authentication
Both webhook ingress Lambdas are currently **unauthenticated** (`authType: NONE`). Consider:
- Validating Plaid/Lithic webhook signatures
- IP whitelisting
- HMAC-SHA256 validation

---

## Part 5: Key Architecture Decisions

### 1. Single-Table DynamoDB Design
All entity types (users, rules, events, executions, legs, idempotency, audit) stored in one table using `PK/SK` composite key pattern with GSI support. This simplifies deployments but requires careful key design.

### 2. Step Function Orchestration
Transfers are orchestrated via AWS Step Functions (not Lambda), enabling:
- Visually trackable state transitions
- Built-in retry/error handling
- Long-running operation support (up to 1 year)
- Parallel leg processing (Map state, max 4 concurrent)

### 3. Correlation ID Propagation
End-to-end request tracing via correlation IDs extracted from HTTP headers, enabling audit trails and debugging across async operations.

### 4. Dual-Provider Support
Architecture supports both Plaid and Lithic webhooks feeding the same transfer orchestration pipeline, enabling provider flexibility.

### 5. Idempotency as First-Class Concern
Idempotency locks for inbound webhooks, transfer executions, and compensations prevent duplicate charges and reversals.

### 6. Separated Concerns
- **Ingress**: Webhook validation and triggering (thin lambdas)
- **Orchestration**: Step Functions for workflow
- **Execution**: Core transfer logic (ProcessTransferLeg, CompensateTransferLeg)
- **Providers**: Abstracted interfaces for external services

---

## Summary Table

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Infrastructure** | AWS CDK | Infrastructure as code |
| **Orchestration** | Step Functions | Transfer workflow coordination |
| **Processing** | Lambda (Node.js) | Event ingestion, transfer execution |
| **Data** | DynamoDB | Single-table persistent storage |
| **External Integrations** | Plaid, Lithic webhooks | Deposit events + transfer execution |
| **Frontend** | Next.js 16 + React 19 | Dashboard UI |
| **Frontend HTTP Client** | Axios | REST API communication |
| **Plaid Integration (FE)** | react-plaid-link | Bank account linking UI |
| **Forms** | React Hook Form + Zod | Validation |
| **UI Library** | Shadcn/UI (Radix) | Component primitives |

