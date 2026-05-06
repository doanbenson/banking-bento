"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const api_response_1 = require("./shared/api-response");
const plaid_client_1 = require("./shared/plaid-client");
const handler = async (event) => {
    try {
        if ((0, plaid_client_1.getPlaidEnvironment)() !== "sandbox") {
            return (0, api_response_1.fail)(400, "PLAID_SANDBOX_ONLY", "Sandbox public token creation is only available when PLAID_ENV=sandbox.");
        }
        const plaidClient = (0, plaid_client_1.createPlaidClient)();
        const response = await plaidClient.sandboxPublicTokenCreate({
            institution_id: process.env.PLAID_SANDBOX_INSTITUTION_ID || "ins_109508",
            initial_products: (0, plaid_client_1.getPlaidProducts)()
        });
        return (0, api_response_1.ok)({
            public_token: response.data.public_token,
            request_id: response.data.request_id,
            environment: "sandbox"
        });
    }
    catch (error) {
        console.error("Plaid Sandbox Public Token Error:", error);
        return (0, api_response_1.fail)(500, "PLAID_SANDBOX_PUBLIC_TOKEN_FAILED", "Failed to create Plaid sandbox public token", {
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
};
exports.handler = handler;
