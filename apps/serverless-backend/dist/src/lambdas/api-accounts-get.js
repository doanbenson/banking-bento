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
        const accountId = event.pathParameters?.accountId;
        const accounts = await repo.accounts.getAccountsByUser(userId);
        if (accountId) {
            const account = accounts.find((item) => item.accountId === accountId) ?? null;
            return (0, api_response_1.ok)({ account });
        }
        return (0, api_response_1.ok)({ accounts });
    }
    catch (error) {
        return (0, api_response_1.fail)(500, "INTERNAL_ERROR", "Failed to fetch accounts", {
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
};
exports.handler = handler;
