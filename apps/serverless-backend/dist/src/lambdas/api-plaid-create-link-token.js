"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const api_response_1 = require("./shared/api-response");
const plaid_client_1 = require("./shared/plaid-client");
const handler = async (event) => {
    try {
        const body = event.body ? JSON.parse(event.body) : {};
        const userId = body.user_id ?? body.userId ?? "user-sandbox";
        const plaidClient = (0, plaid_client_1.createPlaidClient)();
        const response = await plaidClient.linkTokenCreate({
            client_name: process.env.PLAID_CLIENT_NAME || "Banking Bento",
            country_codes: (0, plaid_client_1.getPlaidCountryCodes)(),
            language: process.env.PLAID_LANGUAGE || "en",
            products: (0, plaid_client_1.getPlaidProducts)(),
            user: {
                client_user_id: userId
            },
            ...(process.env.PLAID_REDIRECT_URI ? { redirect_uri: process.env.PLAID_REDIRECT_URI } : {}),
            ...(process.env.PLAID_WEBHOOK_URL ? { webhook: process.env.PLAID_WEBHOOK_URL } : {})
        });
        return (0, api_response_1.ok)({
            link_token: response.data.link_token,
            expiration: response.data.expiration,
            request_id: response.data.request_id,
            environment: (0, plaid_client_1.getPlaidEnvironment)()
        });
    }
    catch (error) {
        console.error("Plaid Link Token Error:", error);
        return (0, api_response_1.fail)(500, "PLAID_LINK_TOKEN_FAILED", "Failed to create Plaid link token", {
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
};
exports.handler = handler;
