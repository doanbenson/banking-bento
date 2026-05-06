import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { fail, ok } from "./shared/api-response";
import { createPlaidClient, getPlaidEnvironment } from "./shared/plaid-client";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return fail(400, "BAD_REQUEST", "Missing request body");
    }

    const body = JSON.parse(event.body);
    const { public_token } = body;

    if (!public_token) {
      return fail(400, "BAD_REQUEST", "Missing public_token");
    }

    const plaidClient = createPlaidClient();
    const response = await plaidClient.itemPublicTokenExchange({
      public_token
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    return ok({ 
      access_token: accessToken, 
      item_id: itemId,
      request_id: response.data.request_id,
      environment: getPlaidEnvironment()
    });

  } catch (error: unknown) {
    console.error("Plaid Exchange Error:", error);
    return fail(
      500,
      "PLAID_EXCHANGE_FAILED",
      "Failed to exchange Plaid public token",
      {
        message: error instanceof Error ? error.message : "Unknown error"
      }
    );
  }
};
