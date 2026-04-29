import { ExecutionStatus, LegStatus, SplitRule } from "../contracts/execution";

export type IdempotencyScope = "webhook" | "transfer" | "compensation";
export type IdempotencyStatus = "RECEIVED" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED";

export interface UserProfileRecord {
  userId: string;
  status: "ACTIVE" | "PAUSED";
  createdAtIso: string;
  updatedAtIso: string;
}

export interface SplitRuleRecord extends SplitRule {
  userId: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface EventMetadataRecord {
  eventId: string;
  userId: string;
  source: "plaid";
  sourceAccountId: string;
  amountMinor: number;
  currency: string;
  postedAtIso: string;
  executionId?: string;
  createdAtIso: string;
}

export interface AccountRecord {
  accountId: string;
  userId: string;
  itemId: string;
  mask: string;
  name: string;
  subtype: string;
  balances: {
    available?: number;
    current?: number;
    isoCurrencyCode?: string;
  };
  createdAtIso: string;
  updatedAtIso: string;
}

export interface TransactionRecord {
  transactionId: string;
  accountId: string;
  userId: string;
  amountMinor: number;
  date: string;
  name: string;
  pending: boolean;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface ExecutionSummaryRecord {
  executionId: string;
  userId: string;
  sourceEventId: string;
  sourceAccountId: string;
  sourceAmountMinor: number;
  currency: string;
  status: ExecutionStatus;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface TransferLegRecord {
  executionId: string;
  legId: string;
  destinationAccountId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  status: LegStatus;
  providerTransferId?: string;
  reason?: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface IdempotencyRecord {
  scope: IdempotencyScope;
  key: string;
  status: IdempotencyStatus;
  requestHash: string;
  responseHash?: string;
  linkedExecutionId?: string;
  lockExpiresAtIso?: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface AuditRecord {
  day: string;
  executionId: string;
  step: string;
  timestampIso: string;
  detail: Record<string, unknown>;
}
