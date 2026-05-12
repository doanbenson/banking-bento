"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlaidCountryCodes = exports.getPlaidProducts = exports.createPlaidClient = exports.getPlaidEnvironment = void 0;
const client_ssm_1 = require("@aws-sdk/client-ssm");
const plaid_1 = require("plaid");
// ---------------------------------------------------------------------------
// SSM client — points to LocalStack when LOCALSTACK_ENDPOINT is set
// ---------------------------------------------------------------------------
const buildSsmClient = () => {
    const localstackEndpoint = process.env.LOCALSTACK_ENDPOINT || process.env.AWS_ENDPOINT_URL;
    if (localstackEndpoint) {
        return new client_ssm_1.SSMClient({
            endpoint: localstackEndpoint,
            region: process.env.AWS_REGION || "us-east-1",
            credentials: {
                accessKeyId: "test",
                secretAccessKey: "test",
            },
        });
    }
    return new client_ssm_1.SSMClient({});
};
let cachedCredentials = null;
const normalizePlaidEnvironment = (value) => {
    if (value === "development" || value === "production")
        return value;
    return "sandbox";
};
// ---------------------------------------------------------------------------
// SSM parameter paths
// ---------------------------------------------------------------------------
const SSM_PREFIX = process.env.PLAID_SSM_PREFIX || "/banking-bento/plaid";
const ssmParamName = (suffix) => `${SSM_PREFIX}/${suffix}`;
// ---------------------------------------------------------------------------
// Core SSM fetch
// ---------------------------------------------------------------------------
const loadCredentialsFromSsm = async () => {
    if (cachedCredentials)
        return cachedCredentials;
    const environment = normalizePlaidEnvironment(process.env.PLAID_ENV);
    const ssm = buildSsmClient();
    const { Parameters, InvalidParameters } = await ssm.send(new client_ssm_1.GetParametersCommand({
        Names: [
            ssmParamName("client-id"),
            ssmParamName(`secret-${environment}`),
        ],
        WithDecryption: true,
    }));
    if (InvalidParameters && InvalidParameters.length > 0) {
        throw new Error(`SSM parameters not found: ${InvalidParameters.join(", ")}. ` +
            `Run 'npm run ssm:seed' to seed LocalStack, or create real SSM parameters.`);
    }
    const byName = Object.fromEntries((Parameters ?? []).map((p) => [p.Name, p.Value]));
    const clientId = byName[ssmParamName("client-id")];
    const secret = byName[ssmParamName(`secret-${environment}`)];
    if (!clientId || !secret) {
        throw new Error(`Plaid ${environment} credentials are missing in SSM at prefix "${SSM_PREFIX}". ` +
            `Expected: ${ssmParamName("client-id")} and ${ssmParamName(`secret-${environment}`)}.`);
    }
    cachedCredentials = { environment, clientId, secret };
    return cachedCredentials;
};
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
const getPlaidEnvironment = () => normalizePlaidEnvironment(process.env.PLAID_ENV);
exports.getPlaidEnvironment = getPlaidEnvironment;
/**
 * Creates a configured PlaidApi client by resolving credentials from AWS SSM
 * Parameter Store. Credentials are cached in-memory after the first fetch so
 * subsequent calls within the same Lambda container are free.
 */
const createPlaidClient = async () => {
    const { environment, clientId, secret } = await loadCredentialsFromSsm();
    const configuration = new plaid_1.Configuration({
        basePath: plaid_1.PlaidEnvironments[environment],
        baseOptions: {
            headers: {
                "PLAID-CLIENT-ID": clientId,
                "PLAID-SECRET": secret,
            },
        },
    });
    return new plaid_1.PlaidApi(configuration);
};
exports.createPlaidClient = createPlaidClient;
const getPlaidProducts = () => {
    const configuredProducts = process.env.PLAID_PRODUCTS?.trim();
    if (!configuredProducts)
        return [plaid_1.Products.Transactions];
    return configuredProducts
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
};
exports.getPlaidProducts = getPlaidProducts;
const getPlaidCountryCodes = () => {
    const configuredCountryCodes = process.env.PLAID_COUNTRY_CODES?.trim();
    if (!configuredCountryCodes)
        return [plaid_1.CountryCode.Us];
    return configuredCountryCodes
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
};
exports.getPlaidCountryCodes = getPlaidCountryCodes;
