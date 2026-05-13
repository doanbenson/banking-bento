"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const api_response_1 = require("./shared/api-response");
const plaid_client_1 = require("./shared/plaid-client");
const dynamodb_banking_core_repositories_1 = require("../repositories/dynamodb-banking-core-repositories");
const aws_dynamo_repository_client_1 = require("../repositories/aws-dynamo-repository-client");
const repo = (0, dynamodb_banking_core_repositories_1.createDynamoBankingCoreRepositories)(new aws_dynamo_repository_client_1.AwsDynamoRepositoryClient());
const toPlaidDate = (date) => date.toISOString().split("T")[0];
const handler = async (event) => {
    try {
        const userId = event.queryStringParameters?.user_id ?? event.queryStringParameters?.userId ?? "user-123";
        const itemId = event.pathParameters?.itemId;
        if (!itemId) {
            return (0, api_response_1.fail)(400, "BAD_REQUEST", "Missing Plaid item id");
        }
        if (!event.body) {
            return (0, api_response_1.fail)(400, "BAD_REQUEST", "Missing request body");
        }
        const body = JSON.parse(event.body);
        const accessToken = body.access_token ?? body.accessToken;
        if (!accessToken) {
            return (0, api_response_1.fail)(400, "BAD_REQUEST", "Missing access_token");
        }
        const nowIso = new Date().toISOString();
        const plaidClient = await (0, plaid_client_1.createPlaidClient)();
        const endDate = toPlaidDate(new Date());
        const startDate = toPlaidDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
        const [accountsResponse, transactionsResponse] = await Promise.all([
            plaidClient.accountsGet({ access_token: accessToken }),
            plaidClient.transactionsGet({
                access_token: accessToken,
                start_date: startDate,
                end_date: endDate,
                options: {
                    count: 500,
                    offset: 0
                }
            })
        ]);
        const accounts = accountsResponse.data.accounts;
        const transactions = transactionsResponse.data.transactions;
        await Promise.all(accounts.map((account) => {
            const balances = {};
            if (account.balances.available !== null)
                balances.available = account.balances.available;
            if (account.balances.current !== null)
                balances.current = account.balances.current;
            if (account.balances.iso_currency_code !== null) {
                balances.isoCurrencyCode = account.balances.iso_currency_code;
            }
            return repo.accounts.putAccount({
                accountId: account.account_id,
                userId,
                itemId,
                mask: account.mask ?? "",
                name: account.name,
                subtype: account.subtype ?? account.type,
                balances,
                createdAtIso: nowIso,
                updatedAtIso: nowIso
            });
        }));
        await Promise.all(transactions.map((transaction) => {
            return repo.transactions.putTransaction({
                transactionId: transaction.transaction_id,
                accountId: transaction.account_id,
                userId,
                amountMinor: Math.round(transaction.amount * 100),
                date: transaction.date,
                name: transaction.merchant_name ?? transaction.name,
                pending: transaction.pending,
                createdAtIso: nowIso,
                updatedAtIso: nowIso
            });
        }));
        return (0, api_response_1.ok)({
            synced: true,
            item_id: itemId,
            accounts_synced: accounts.length,
            transactions_synced: transactions.length,
            request_ids: {
                accounts: accountsResponse.data.request_id,
                transactions: transactionsResponse.data.request_id
            }
        });
    }
    catch (error) {
        return (0, api_response_1.fail)(500, "INTERNAL_ERROR", "Failed to sync transactions", {
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
};
exports.handler = handler;
