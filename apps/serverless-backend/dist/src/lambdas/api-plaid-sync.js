"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const api_response_1 = require("./shared/api-response");
const dynamodb_banking_core_repositories_1 = require("../repositories/dynamodb-banking-core-repositories");
const aws_dynamo_repository_client_1 = require("../repositories/aws-dynamo-repository-client");
const repo = (0, dynamodb_banking_core_repositories_1.createDynamoBankingCoreRepositories)(new aws_dynamo_repository_client_1.AwsDynamoRepositoryClient());
const handler = async (event) => {
    try {
        const userId = event.queryStringParameters?.user_id ?? event.queryStringParameters?.userId ?? "user-123";
        const itemId = event.pathParameters?.itemId ?? "item-123";
        const nowIso = new Date().toISOString();
        const date = nowIso.split("T")[0];
        const accountId = `acc-${itemId}`;
        await repo.accounts.putAccount({
            accountId,
            userId,
            itemId,
            mask: "1234",
            name: "Plaid Checking",
            subtype: "checking",
            balances: { available: 100, current: 150, isoCurrencyCode: "USD" },
            createdAtIso: nowIso,
            updatedAtIso: nowIso
        });
        await repo.transactions.putTransaction({
            transactionId: `txn-${Date.now()}`,
            accountId,
            userId,
            amountMinor: 1000,
            date,
            name: "Starbucks",
            pending: false,
            createdAtIso: nowIso,
            updatedAtIso: nowIso
        });
        return (0, api_response_1.ok)({ synced: true, item_id: itemId });
    }
    catch (error) {
        return (0, api_response_1.fail)(500, "INTERNAL_ERROR", "Failed to sync transactions", {
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
};
exports.handler = handler;
