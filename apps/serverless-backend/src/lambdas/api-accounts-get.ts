import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ok, fail } from "./shared/api-response";
import { createDynamoBankingCoreRepositories } from "../repositories/dynamodb-banking-core-repositories";
import { AwsDynamoRepositoryClient } from "../repositories/aws-dynamo-repository-client";

const repo = createDynamoBankingCoreRepositories(new AwsDynamoRepositoryClient());

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.queryStringParameters?.user_id ?? event.queryStringParameters?.userId ?? "user-123";
    const accountId = event.pathParameters?.accountId;
    const accounts = await repo.accounts.getAccountsByUser(userId);

    if (accountId) {
      const account = accounts.find((item) => item.accountId === accountId) ?? null;
      return ok({ account });
    }

    return ok({ accounts });
  } catch (error: unknown) {
    return fail(500, "INTERNAL_ERROR", "Failed to fetch accounts", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
