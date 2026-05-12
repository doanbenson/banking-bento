"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_sfn_1 = require("@aws-sdk/client-sfn");
const node_crypto_1 = require("node:crypto");
const api_response_1 = require("./shared/api-response");
// Step Functions client — points to LocalStack when LOCALSTACK_ENDPOINT is set
const sfnEndpoint = process.env.LOCALSTACK_ENDPOINT || process.env.AWS_ENDPOINT_URL;
const sfnClient = new client_sfn_1.SFNClient({
    region: process.env.AWS_REGION ?? "us-east-1",
    ...(sfnEndpoint ? { endpoint: sfnEndpoint } : {}),
});
const handler = async (event) => {
    try {
        // Parse and validate body
        if (!event.body) {
            return (0, api_response_1.fail)(400, "MISSING_BODY", "Request body is required");
        }
        let body;
        try {
            body = JSON.parse(event.body);
        }
        catch {
            return (0, api_response_1.fail)(400, "INVALID_JSON", "Request body must be valid JSON");
        }
        const { sourceAccountId, destinationAccountId, amountMinor, currency, note } = body;
        if (!sourceAccountId || !destinationAccountId) {
            return (0, api_response_1.fail)(400, "MISSING_ACCOUNTS", "sourceAccountId and destinationAccountId are required");
        }
        if (sourceAccountId === destinationAccountId) {
            return (0, api_response_1.fail)(400, "SAME_ACCOUNT", "Source and destination accounts must differ");
        }
        if (!amountMinor || typeof amountMinor !== "number" || amountMinor <= 0) {
            return (0, api_response_1.fail)(400, "INVALID_AMOUNT", "amountMinor must be a positive integer (cents)");
        }
        const executionId = (0, node_crypto_1.randomUUID)();
        const legId = (0, node_crypto_1.randomUUID)();
        const stateMachineArn = process.env.STATE_MACHINE_ARN;
        if (!stateMachineArn) {
            // Fallback when State Machine is not wired (dev mode) — simulate success
            return (0, api_response_1.ok)({
                executionId,
                status: "SIMULATED",
                message: "Transfer simulated (STATE_MACHINE_ARN not configured)",
                sourceAccountId,
                destinationAccountId,
                amountMinor,
                currency: currency ?? "USD",
            }, 202);
        }
        const executionInput = {
            executionId,
            correlationId: executionId,
            leg: {
                legId,
                destinationAccountId,
                amountMinor,
                idempotencyKey: `${executionId}:${legId}`,
            },
            sourceAccountId,
            currency: currency ?? "USD",
            note: note ?? "",
        };
        const command = new client_sfn_1.StartExecutionCommand({
            stateMachineArn,
            name: executionId,
            input: JSON.stringify(executionInput),
        });
        await sfnClient.send(command);
        return (0, api_response_1.ok)({
            executionId,
            status: "INITIATED",
            message: "Transfer execution started",
            sourceAccountId,
            destinationAccountId,
            amountMinor,
            currency: currency ?? "USD",
        }, 202);
    }
    catch (error) {
        console.error("Transfer initiation failed", error);
        return (0, api_response_1.fail)(500, "INTERNAL_ERROR", "Failed to initiate transfer", {
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.handler = handler;
