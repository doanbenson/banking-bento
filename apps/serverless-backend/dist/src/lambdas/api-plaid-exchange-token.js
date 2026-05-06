"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const api_response_1 = require("./shared/api-response");
const plaid_client_1 = require("./shared/plaid-client");
const handler = async (event) => {
    try {
        if (!event.body) {
            return (0, api_response_1.fail)(400, "BAD_REQUEST", "Missing request body");
        }
        const body = JSON.parse(event.body);
        const { public_token } = body;
        if (!public_token) {
            return (0, api_response_1.fail)(400, "BAD_REQUEST", "Missing public_token");
        }
        const plaidClient = (0, plaid_client_1.createPlaidClient)();
        const response = await plaidClient.itemPublicTokenExchange({
            public_token
        });
        const accessToken = response.data.access_token;
        const itemId = response.data.item_id;
        return (0, api_response_1.ok)({
            access_token: accessToken,
            item_id: itemId,
            request_id: response.data.request_id,
            environment: (0, plaid_client_1.getPlaidEnvironment)()
        });
    }
    catch (error) {
        console.error("Plaid Exchange Error:", error);
        return (0, api_response_1.fail)(500, "PLAID_EXCHANGE_FAILED", "Failed to exchange Plaid public token", {
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
};
exports.handler = handler;
