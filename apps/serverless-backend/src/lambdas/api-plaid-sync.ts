import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ok, fail } from "./shared/api-response";
import { createPlaidClient } from "./shared/plaid-client";
import { createDynamoBankingCoreRepositories } from "../repositories/dynamodb-banking-core-repositories";
import { AwsDynamoRepositoryClient } from "../repositories/aws-dynamo-repository-client";

const repo = createDynamoBankingCoreRepositories(new AwsDynamoRepositoryClient());

type SyncRequestBody = {
  access_token?: string;
  accessToken?: string;
};

const toPlaidDate = (date: Date): string => date.toISOString().split("T")[0];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.queryStringParameters?.user_id ?? event.queryStringParameters?.userId ?? "user-123";
    const itemId = event.pathParameters?.itemId;

    if (!itemId) {
      return fail(400, "BAD_REQUEST", "Missing Plaid item id");
    }

    if (!event.body) {
      return fail(400, "BAD_REQUEST", "Missing request body");
    }

    const body = JSON.parse(event.body) as SyncRequestBody;
    const accessToken = body.access_token ?? body.accessToken;

    if (!accessToken) {
      return fail(400, "BAD_REQUEST", "Missing access_token");
    }

    const nowIso = new Date().toISOString();
    const plaidClient = await createPlaidClient();
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
      const balances: { available?: number; current?: number; isoCurrencyCode?: string } = {};
      if (account.balances.available !== null) balances.available = account.balances.available;
      if (account.balances.current !== null) balances.current = account.balances.current;
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

    return ok({
      synced: true,
      item_id: itemId,
      accounts_synced: accounts.length,
      transactions_synced: transactions.length,
      request_ids: {
        accounts: accountsResponse.data.request_id,
        transactions: transactionsResponse.data.request_id
      }
    });
  } catch (error: unknown) {
    return fail(500, "INTERNAL_ERROR", "Failed to sync transactions", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
