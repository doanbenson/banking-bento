import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ok, fail } from "./shared/api-response";
import { createDynamoBankingCoreRepositories } from "../repositories/dynamodb-banking-core-repositories";
import { AwsDynamoRepositoryClient } from "../repositories/aws-dynamo-repository-client";

const repo = createDynamoBankingCoreRepositories(new AwsDynamoRepositoryClient());

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.queryStringParameters?.user_id ?? event.queryStringParameters?.userId ?? "user-123";
    const accountId = event.queryStringParameters?.account_id;
    const transactions = await repo.transactions.getTransactionsByUser(userId);
    const filtered = accountId
      ? transactions.filter((item) => item.accountId === accountId)
      : transactions;

    return ok({ transactions: filtered });
  } catch (error: unknown) {
    return fail(500, "INTERNAL_ERROR", "Failed to fetch transactions", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
