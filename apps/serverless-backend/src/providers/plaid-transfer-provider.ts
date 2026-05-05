export interface TransferProvider {
  /**
   * Executes a transfer to a destination account.
   * Should be idempotent; if called with a known idempotency key, it should return the original result.
   */
  executeTransfer(input: {
    idempotencyKey: string;
    destinationAccountId: string;
    amountMinor: number;
    currency: string;
    description?: string;
  }): Promise<{
    providerTransferId: string;
    status: 'COMPLETED' | 'PENDING' | 'FAILED';
    reason?: string;
  }>;

  /**
   * Reverses a transfer previously made.
   * If the transfer has already settled, it initiates a return/refund.
   * If pending, it might cancel it.
   */
  reverseTransfer(input: {
    executionId: string;
    legId: string;
    idempotencyKey: string;
    providerTransferId: string;
    amountMinor?: number;
    currency?: string;
    reason?: string;
    description?: string;
  }): Promise<{
    status: 'COMPLETED' | 'PENDING' | 'FAILED';
    reason?: string;
    providerCompensationId?: string;
  }>;
}

export const getDefaultPlaidTransferProvider = (): PlaidTransferProvider => new PlaidTransferProvider();

export class PlaidTransferProvider implements TransferProvider {
  async executeTransfer(input: {
    idempotencyKey: string;
    destinationAccountId: string;
    amountMinor: number;
    currency: string;
    description?: string;
  }): Promise<{ providerTransferId: string; status: "COMPLETED" | "PENDING" | "FAILED"; reason?: string; }> {
    console.log(`[PlaidTransferProvider] Executing transfer`, input);
    // In a real app we'd interact with Plaid Node SDK:
    // await this.plaidClient.transferCreate(...)
    return {
      providerTransferId: `plaid-tf-${Date.now()}`,
      status: "COMPLETED"
    };
  }

  async reverseTransfer(input: {
    executionId: string;
    legId: string;
    idempotencyKey: string;
    providerTransferId: string;
    amountMinor?: number;
    currency?: string;
    reason?: string;
    description?: string;
  }): Promise<{ status: "COMPLETED" | "PENDING" | "FAILED"; reason?: string; providerCompensationId?: string; }> {
    console.log(`[PlaidTransferProvider] Reversing transfer`, input);
    // In a real app we'd interact with Plaid Node SDK:
    // await this.plaidClient.transferCancel(...)
    return {
      status: "COMPLETED",
      providerCompensationId: `plaid-cmp-${Date.now()}`
    };
  }
}

