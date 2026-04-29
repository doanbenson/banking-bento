"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const dynamodb_banking_core_repositories_1 = require("../repositories/dynamodb-banking-core-repositories");
const repo = (0, dynamodb_banking_core_repositories_1.createDynamoBankingCoreRepositories)(new client_1.DynamoRepositoryClient());
const handler = async (event) => {
    try {
        const userId = event.queryStringParameters?.userId || "user-123";
        const accounts = await repo.accounts.getAccountsByUser(userId);
        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify(accounts)
        };
    }
    catch (error) {
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: error.message })
        };
    }
};
exports.handler = handler;
