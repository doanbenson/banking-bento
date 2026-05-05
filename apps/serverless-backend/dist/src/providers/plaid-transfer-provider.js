"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaidTransferProvider = exports.getDefaultPlaidTransferProvider = void 0;
const getDefaultPlaidTransferProvider = () => new PlaidTransferProvider();
exports.getDefaultPlaidTransferProvider = getDefaultPlaidTransferProvider;
class PlaidTransferProvider {
    async executeTransfer(input) {
        console.log(`[PlaidTransferProvider] Executing transfer`, input);
        // In a real app we'd interact with Plaid Node SDK:
        // await this.plaidClient.transferCreate(...)
        return {
            providerTransferId: `plaid-tf-${Date.now()}`,
            status: "COMPLETED"
        };
    }
    async reverseTransfer(input) {
        console.log(`[PlaidTransferProvider] Reversing transfer`, input);
        // In a real app we'd interact with Plaid Node SDK:
        // await this.plaidClient.transferCancel(...)
        return {
            status: "COMPLETED",
            providerCompensationId: `plaid-cmp-${Date.now()}`
        };
    }
}
exports.PlaidTransferProvider = PlaidTransferProvider;
