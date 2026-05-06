import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { fail, ok } from "./shared/api-response";
import { createPlaidClient, getPlaidEnvironment, getPlaidProducts } from "./shared/plaid-client";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (getPlaidEnvironment() !== "sandbox") {
      return fail(
        400,
        "PLAID_SANDBOX_ONLY",
        "Sandbox public token creation is only available when PLAID_ENV=sandbox."
      );
    }

    const plaidClient = createPlaidClient();
    const response = await plaidClient.sandboxPublicTokenCreate({
      institution_id: process.env.PLAID_SANDBOX_INSTITUTION_ID || "ins_109508",
      initial_products: getPlaidProducts()
    });

    return ok({
      public_token: response.data.public_token,
      request_id: response.data.request_id,
      environment: "sandbox"
    });
  } catch (error: unknown) {
    console.error("Plaid Sandbox Public Token Error:", error);
    return fail(500, "PLAID_SANDBOX_PUBLIC_TOKEN_FAILED", "Failed to create Plaid sandbox public token", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
