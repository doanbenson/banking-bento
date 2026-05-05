export type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type BackendAccount = {
  accountId: string;
  name: string;
  mask?: string;
  subtype: string;
  balances: {
    available?: number;
    current?: number;
  };
};

export type BackendTransaction = {
  transactionId: string;
  accountId: string;
  amountMinor: number;
  date: string;
  name: string;
  pending: boolean;
};
