import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { randomUUID } from "node:crypto";
import { ok, fail } from "./shared/api-response";

// Step Functions client — points to LocalStack when LOCALSTACK_ENDPOINT is set
const sfnEndpoint = process.env.LOCALSTACK_ENDPOINT || process.env.AWS_ENDPOINT_URL;

const sfnClient = new SFNClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(sfnEndpoint ? { endpoint: sfnEndpoint } : {}),
});

interface TransferRequest {
  sourceAccountId: string;
  destinationAccountId: string;
  amountMinor: number;
  currency: string;
  note?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Parse and validate body
    if (!event.body) {
      return fail(400, "MISSING_BODY", "Request body is required");
    }

    let body: TransferRequest;
    try {
      body = JSON.parse(event.body) as TransferRequest;
    } catch {
      return fail(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const { sourceAccountId, destinationAccountId, amountMinor, currency, note } = body;

    if (!sourceAccountId || !destinationAccountId) {
      return fail(400, "MISSING_ACCOUNTS", "sourceAccountId and destinationAccountId are required");
    }
    if (sourceAccountId === destinationAccountId) {
      return fail(400, "SAME_ACCOUNT", "Source and destination accounts must differ");
    }
    if (!amountMinor || typeof amountMinor !== "number" || amountMinor <= 0) {
      return fail(400, "INVALID_AMOUNT", "amountMinor must be a positive integer (cents)");
    }

    const executionId = randomUUID();
    const legId = randomUUID();
    const stateMachineArn = process.env.STATE_MACHINE_ARN;

    if (!stateMachineArn) {
      // Fallback when State Machine is not wired (dev mode) — simulate success
      return ok({
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

    const command = new StartExecutionCommand({
      stateMachineArn,
      name: executionId,
      input: JSON.stringify(executionInput),
    });

    await sfnClient.send(command);

    return ok({
      executionId,
      status: "INITIATED",
      message: "Transfer execution started",
      sourceAccountId,
      destinationAccountId,
      amountMinor,
      currency: currency ?? "USD",
    }, 202);
  } catch (error: unknown) {
    console.error("Transfer initiation failed", error);
    return fail(500, "INTERNAL_ERROR", "Failed to initiate transfer", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
