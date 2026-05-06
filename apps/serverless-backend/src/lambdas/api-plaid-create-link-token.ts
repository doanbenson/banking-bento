import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { fail, ok } from "./shared/api-response";
import {
  createPlaidClient,
  getPlaidCountryCodes,
  getPlaidEnvironment,
  getPlaidProducts
} from "./shared/plaid-client";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const userId = body.user_id ?? body.userId ?? "user-sandbox";
    const plaidClient = createPlaidClient();

    const response = await plaidClient.linkTokenCreate({
      client_name: process.env.PLAID_CLIENT_NAME || "Banking Bento",
      country_codes: getPlaidCountryCodes(),
      language: process.env.PLAID_LANGUAGE || "en",
      products: getPlaidProducts(),
      user: {
        client_user_id: userId
      },
      ...(process.env.PLAID_REDIRECT_URI ? { redirect_uri: process.env.PLAID_REDIRECT_URI } : {}),
      ...(process.env.PLAID_WEBHOOK_URL ? { webhook: process.env.PLAID_WEBHOOK_URL } : {})
    });

    return ok({
      link_token: response.data.link_token,
      expiration: response.data.expiration,
      request_id: response.data.request_id,
      environment: getPlaidEnvironment()
    });
  } catch (error: unknown) {
    console.error("Plaid Link Token Error:", error);
    return fail(500, "PLAID_LINK_TOKEN_FAILED", "Failed to create Plaid link token", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
