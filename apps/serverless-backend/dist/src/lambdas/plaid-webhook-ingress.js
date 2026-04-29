"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.createHandler = void 0;
const client_lambda_1 = require("@aws-sdk/client-lambda");
const inbound_lock_repository_1 = require("../idempotency/inbound-lock-repository");
const key_builders_1 = require("../idempotency/key-builders");
const execution_context_1 = require("../observability/execution-context");
const metrics_alarms_1 = require("../observability/metrics-alarms");
const structured_logger_1 = require("../observability/structured-logger");
const parseBody = (body) => {
    if (!body) {
        return { ok: true, value: {} };
    }
    try {
        return { ok: true, value: JSON.parse(body) };
    }
    catch {
        return { ok: false, error: "Invalid JSON body" };
    }
};
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isPositiveInteger = (value) => typeof value === "number" && Number.isInteger(value) && value > 0;
const isValidCurrency = (value) => /^[A-Z]{3}$/.test(value);
const isValidIsoTimestamp = (value) => !Number.isNaN(Date.parse(value));
const isPlaidDepositPayload = (value) => {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const payload = value;
    return (isNonEmptyString(payload.webhook_id) &&
        isNonEmptyString(payload.user_id) &&
        isNonEmptyString(payload.account_id) &&
        isPositiveInteger(payload.amount_minor) &&
        isNonEmptyString(payload.currency) &&
        isValidCurrency(payload.currency.toUpperCase()) &&
        isNonEmptyString(payload.posted_at) &&
        isValidIsoTimestamp(payload.posted_at));
};
const toDepositReceivedEvent = (payload) => ({
    source: "plaid",
    externalEventId: payload.webhook_id.trim(),
    userId: payload.user_id.trim(),
    accountId: payload.account_id.trim(),
    amountMinor: payload.amount_minor,
    currency: payload.currency.toUpperCase(),
    postedAtIso: payload.posted_at
});
const badRequest = (error) => ({
    statusCode: 400,
    body: JSON.stringify({
        accepted: false,
        status: "invalid",
        error
    })
});
const logger = (0, structured_logger_1.createStructuredLogger)({
    service: "serverless-backend",
    component: "plaid-webhook-ingress"
});
const createHandler = (lockRepository = (0, inbound_lock_repository_1.getDefaultInboundIdempotencyLockRepository)()) => {
    return async (event) => {
        const executionContext = (0, execution_context_1.createExecutionContext)({
            correlationId: (0, execution_context_1.extractCorrelationIdFromHeaders)(event.headers)
        });
        const parsed = parseBody(event.body);
        if (parsed.ok && typeof parsed.value === 'object' && parsed.value !== null) {
            const payload = parsed.value;
            if (payload.webhook_type === 'TRANSACTIONS' && payload.webhook_code === 'SYNC_UPDATES_AVAILABLE') {
                const lambda = new client_lambda_1.LambdaClient({});
                await lambda.send(new client_lambda_1.InvokeCommand({
                    FunctionName: process.env.PLAID_SYNC_LAMBDA_NAME || 'UnknownApp-PlaidSync',
                    InvocationType: 'Event',
                    Payload: Buffer.from(JSON.stringify(payload))
                }));
                return { statusCode: 200, body: JSON.stringify({ accepted: true, status: 'sync_triggered' }) };
            }
        }
        if (!parsed.ok) {
            logger.warn("Rejected webhook request due to invalid JSON", {
                classification: "WEBHOOK_VALIDATION_FAILED",
                executionContext,
                metricName: metrics_alarms_1.OBSERVABILITY_METRICS.webhookValidationFailures.metricName,
                metricValue: 1
            });
            return badRequest(parsed.error);
        }
        if (!isPlaidDepositPayload(parsed.value)) {
            logger.warn("Rejected webhook request due to payload validation failure", {
                classification: "WEBHOOK_VALIDATION_FAILED",
                executionContext,
                metricName: metrics_alarms_1.OBSERVABILITY_METRICS.webhookValidationFailures.metricName,
                metricValue: 1
            });
            return badRequest("Invalid plaid webhook payload");
        }
        const domainEvent = toDepositReceivedEvent(parsed.value);
        const inboundIdempotencyKey = (0, key_builders_1.buildInboundWebhookIdempotencyKey)(domainEvent);
        try {
            const lockResult = await lockRepository.acquireInboundLock({
                source: domainEvent.source,
                idempotencyKey: inboundIdempotencyKey,
                externalEventId: domainEvent.externalEventId,
                receivedAtIso: new Date().toISOString()
            });
            if (lockResult.status === "DUPLICATE") {
                logger.info("Webhook request identified as duplicate", {
                    executionContext,
                    source: domainEvent.source,
                    externalEventId: domainEvent.externalEventId,
                    inboundIdempotencyKey
                });
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        accepted: false,
                        status: "duplicate",
                        inboundIdempotencyKey,
                        correlationId: executionContext.correlationId,
                        normalizedEvent: domainEvent
                    })
                };
            }
            logger.info("Webhook request accepted", {
                executionContext,
                source: domainEvent.source,
                externalEventId: domainEvent.externalEventId,
                inboundIdempotencyKey
            });
            return {
                statusCode: 202,
                body: JSON.stringify({
                    accepted: true,
                    status: "accepted",
                    inboundIdempotencyKey,
                    correlationId: executionContext.correlationId,
                    normalizedEvent: domainEvent
                })
            };
        }
        catch (error) {
            logger.error("Failed to process webhook idempotency lock", {
                classification: "UNEXPECTED",
                executionContext,
                source: domainEvent.source,
                externalEventId: domainEvent.externalEventId,
                inboundIdempotencyKey,
                error
            });
            throw error;
        }
    };
};
exports.createHandler = createHandler;
exports.handler = (0, exports.createHandler)();
