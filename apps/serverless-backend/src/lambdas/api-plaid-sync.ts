import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ok, fail } from "./shared/api-response";
import { createDynamoBankingCoreRepositories } from "../repositories/dynamodb-banking-core-repositories";
import { AwsDynamoRepositoryClient } from "../repositories/aws-dynamo-repository-client";

const repo = createDynamoBankingCoreRepositories(new AwsDynamoRepositoryClient());

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

    return ok({ synced: true, item_id: itemId });
  } catch (error: unknown) {
    return fail(500, "INTERNAL_ERROR", "Failed to sync transactions", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
