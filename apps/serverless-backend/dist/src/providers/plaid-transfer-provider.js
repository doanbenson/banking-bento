"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaidTransferProvider = exports.getDefaultPlaidTransferProvider = void 0;
const getDefaultPlaidTransferProvider = () => new PlaidTransferProvider();
exports.getDefaultPlaidTransferProvider = getDefaultPlaidTransferProvider;
const plaid_1 = require("plaid");
const provider_errors_1 = require("../errors/provider-errors");
const client_ssm_1 = require("@aws-sdk/client-ssm");
class PlaidTransferProvider {
    client;
    async getClient() {
        if (this.client)
            return this.client;
        // Prefer direct env vars for simple deployments; fall back to SSM Parameter Store
        let clientId = process.env.PLAID_CLIENT_ID;
        let secret = process.env.PLAID_SECRET;
        let env = (process.env.PLAID_ENV ?? 'sandbox').toLowerCase();
        if ((!clientId || !secret) && process.env.PLAID_SSM_PREFIX) {
            const ssmPrefix = process.env.PLAID_SSM_PREFIX;
            const ssmEndpoint = process.env.LOCALSTACK_ENDPOINT || process.env.AWS_ENDPOINT_URL;
            const ssm = new client_ssm_1.SSMClient({ ...(ssmEndpoint ? { endpoint: ssmEndpoint } : {}), region: process.env.AWS_REGION ?? 'us-east-1' });
            // Fetch env override first
            try {
                const envParam = await ssm.send(new client_ssm_1.GetParameterCommand({ Name: `${ssmPrefix}/env`, WithDecryption: false }));
                if (envParam.Parameter?.Value)
                    env = envParam.Parameter.Value;
            }
            catch (e) {
                // ignore missing env param
            }
            // client id
            if (!clientId) {
                try {
                    const res = await ssm.send(new client_ssm_1.GetParameterCommand({ Name: `${ssmPrefix}/client-id`, WithDecryption: true }));
                    if (res.Parameter?.Value)
                        clientId = res.Parameter.Value;
                }
                catch (e) {
                    // will be handled below
                }
            }
            // secret variants
            if (!secret) {
                const keys = [`secret-${env}`, 'secret'];
                for (const k of keys) {
                    try {
                        const res = await ssm.send(new client_ssm_1.GetParameterCommand({ Name: `${ssmPrefix}/${k}`, WithDecryption: true }));
                        if (res.Parameter?.Value) {
                            secret = res.Parameter.Value;
                            break;
                        }
                    }
                    catch (e) {
                        // try next
                    }
                }
            }
        }
        if (!clientId || !secret) {
            throw new provider_errors_1.ProviderTerminalError('Plaid credentials not configured', 'PLAID_MISSING_CREDENTIALS');
        }
        const envUpper = (env ?? 'sandbox').toUpperCase();
        const basePath = plaid_1.PlaidEnvironments[envUpper] ?? plaid_1.PlaidEnvironments.Sandbox;
        const configuration = new plaid_1.Configuration({
            basePath,
            baseOptions: {
                headers: {
                    'PLAID-CLIENT-ID': clientId,
                    'PLAID-SECRET': secret,
                }
            }
        });
        this.client = new plaid_1.PlaidApi(configuration);
        return this.client;
    }
    async executeTransfer(input) {
        console.log(`[PlaidTransferProvider] Executing transfer`, input);
        const client = await this.getClient();
        try {
            const amountDecimal = (input.amountMinor / 100).toFixed(2);
            // Use any casts to avoid depending on specific typings for request shapes here
            const req = {
                idempotency_key: input.idempotencyKey,
                amount: { currency: input.currency, value: amountDecimal },
                destination: { account_id: input.destinationAccountId },
            };
            if (input.description)
                req.description = input.description;
            const res = await client.transferCreate(req);
            const transfer = res?.data?.transfer ?? res?.transfer ?? res?.data;
            const providerTransferId = transfer?.id ?? transfer?.transfer_id ?? String(Date.now());
            const statusRaw = transfer?.status ?? 'success';
            const status = (String(statusRaw).toLowerCase().includes('pending') || String(statusRaw).toLowerCase().includes('processing'))
                ? 'PENDING'
                : 'COMPLETED';
            return { providerTransferId, status };
        }
        catch (err) {
            console.error('[PlaidTransferProvider] executeTransfer error', err);
            const msg = err instanceof Error ? err.message : String(err);
            // Plaid API errors may be transient (rate limits, 5xx) or terminal (invalid account)
            // Conservatively map network/5xx to transient, others to terminal
            const transient = /timeout|timed out|ECONNRESET|ECONNREFUSED|5\d{2}|rate limit/i.test(msg);
            if (transient)
                throw new provider_errors_1.ProviderTransientError(msg, 'PLAID_TRANSIENT');
            throw new provider_errors_1.ProviderTerminalError(msg, 'PLAID_ERROR');
        }
    }
    async reverseTransfer(input) {
        console.log(`[PlaidTransferProvider] Reversing transfer`, input);
        const client = await this.getClient();
        try {
            const req = {
                transfer_id: input.providerTransferId,
                idempotency_key: input.idempotencyKey,
            };
            if (input.reason)
                req.reason = input.reason;
            const res = await client.transferCancel(req);
            const result = res?.data ?? res;
            const providerCompensationId = result?.id ?? result?.cancel_id ?? `comp-${Date.now()}`;
            return { status: 'COMPLETED', providerCompensationId };
        }
        catch (err) {
            console.error('[PlaidTransferProvider] reverseTransfer error', err);
            const msg = err instanceof Error ? err.message : String(err);
            const transient = /timeout|timed out|ECONNRESET|ECONNREFUSED|5\d{2}|rate limit/i.test(msg);
            if (transient)
                throw new provider_errors_1.ProviderTransientError(msg, 'PLAID_TRANSIENT');
            throw new provider_errors_1.ProviderTerminalError(msg, 'PLAID_ERROR');
        }
    }
}
exports.PlaidTransferProvider = PlaidTransferProvider;
