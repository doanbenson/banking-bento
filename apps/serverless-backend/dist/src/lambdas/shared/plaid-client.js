"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlaidCountryCodes = exports.getPlaidProducts = exports.createPlaidClient = exports.assertPlaidCredentials = exports.getPlaidCredentials = exports.getPlaidEnvironment = void 0;
const plaid_1 = require("plaid");
const normalizePlaidEnvironment = (value) => {
    if (value === "development" || value === "production") {
        return value;
    }
    return "sandbox";
};
const secretForEnvironment = (environment) => {
    if (environment === "sandbox") {
        return process.env.PLAID_SECRET_SANDBOX || process.env.PLAID_SECRET;
    }
    if (environment === "development") {
        return process.env.PLAID_SECRET_DEVELOPMENT || process.env.PLAID_SECRET;
    }
    return process.env.PLAID_SECRET_PRODUCTION || process.env.PLAID_SECRET;
};
const getPlaidEnvironment = () => normalizePlaidEnvironment(process.env.PLAID_ENV);
exports.getPlaidEnvironment = getPlaidEnvironment;
const getPlaidCredentials = () => {
    const environment = (0, exports.getPlaidEnvironment)();
    const clientId = process.env.PLAID_CLIENT_ID;
    const secret = secretForEnvironment(environment);
    return { environment, clientId, secret };
};
exports.getPlaidCredentials = getPlaidCredentials;
const assertPlaidCredentials = () => {
    const credentials = (0, exports.getPlaidCredentials)();
    if (!credentials.clientId || !credentials.secret) {
        throw new Error(`Plaid ${credentials.environment} credentials are not configured. Set PLAID_CLIENT_ID and the matching Plaid secret.`);
    }
    return credentials;
};
exports.assertPlaidCredentials = assertPlaidCredentials;
const createPlaidClient = () => {
    const { environment, clientId, secret } = (0, exports.assertPlaidCredentials)();
    const configuration = new plaid_1.Configuration({
        basePath: plaid_1.PlaidEnvironments[environment],
        baseOptions: {
            headers: {
                "PLAID-CLIENT-ID": clientId,
                "PLAID-SECRET": secret
            }
        }
    });
    return new plaid_1.PlaidApi(configuration);
};
exports.createPlaidClient = createPlaidClient;
const getPlaidProducts = () => {
    const configuredProducts = process.env.PLAID_PRODUCTS?.trim();
    if (!configuredProducts) {
        return [plaid_1.Products.Transactions];
    }
    return configuredProducts
        .split(",")
        .map((product) => product.trim())
        .filter(Boolean);
};
exports.getPlaidProducts = getPlaidProducts;
const getPlaidCountryCodes = () => {
    const configuredCountryCodes = process.env.PLAID_COUNTRY_CODES?.trim();
    if (!configuredCountryCodes) {
        return [plaid_1.CountryCode.Us];
    }
    return configuredCountryCodes
        .split(",")
        .map((countryCode) => countryCode.trim().toUpperCase())
        .filter(Boolean);
};
exports.getPlaidCountryCodes = getPlaidCountryCodes;
