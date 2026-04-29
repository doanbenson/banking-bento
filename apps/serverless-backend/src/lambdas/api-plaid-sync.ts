import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { createDynamoBankingCoreRepositories } from "../repositories/dynamodb-banking-core-repositories";
import { DynamoRepositoryClient } from "../repositories/client";

const repo = createDynamoBankingCoreRepositories(new DynamoRepositoryClient());

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log("Plaid sync triggered");
  // Expected to query Plaid transactions/sync and store to Dynamo
  const userId = "user-123";
  await repo.accounts.putAccount({
    accountId: "acc-" + Date.now(),
    userId,
    itemId: "item-123",
    mask: "1234",
    name: "Plaid Checking",
    subtype: "checking",
    balances: { available: 100, current: 150, isoCurrencyCode: "USD" },
    createdAtIso: new Date().toISOString(),
    updatedAtIso: new Date().toISOString()
  });

  await repo.transactions.putTransaction({
    transactionId: "txn-" + Date.now(),
    accountId: "acc-123",
    userId,
    amountMinor: 1000,
    date: new Date().toISOString().split("T")[0],
    name: "Starbucks",
    pending: false,
    createdAtIso: new Date().toISOString(),
    updatedAtIso: new Date().toISOString()
  });

  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ success: true, message: "Sync complete" })
  };
};
