import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products
} from "plaid";

export type PlaidEnvironmentName = "sandbox" | "development" | "production";

const normalizePlaidEnvironment = (value: string | undefined): PlaidEnvironmentName => {
  if (value === "development" || value === "production") {
    return value;
  }

  return "sandbox";
};

const secretForEnvironment = (environment: PlaidEnvironmentName): string | undefined => {
  if (environment === "sandbox") {
    return process.env.PLAID_SECRET_SANDBOX || process.env.PLAID_SECRET;
  }

  if (environment === "development") {
    return process.env.PLAID_SECRET_DEVELOPMENT || process.env.PLAID_SECRET;
  }

  return process.env.PLAID_SECRET_PRODUCTION || process.env.PLAID_SECRET;
};

export const getPlaidEnvironment = (): PlaidEnvironmentName =>
  normalizePlaidEnvironment(process.env.PLAID_ENV);

export const getPlaidCredentials = () => {
  const environment = getPlaidEnvironment();
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = secretForEnvironment(environment);

  return { environment, clientId, secret };
};

export const assertPlaidCredentials = () => {
  const credentials = getPlaidCredentials();

  if (!credentials.clientId || !credentials.secret) {
    throw new Error(
      `Plaid ${credentials.environment} credentials are not configured. Set PLAID_CLIENT_ID and the matching Plaid secret.`
    );
  }

  return credentials as {
    environment: PlaidEnvironmentName;
    clientId: string;
    secret: string;
  };
};

export const createPlaidClient = (): PlaidApi => {
  const { environment, clientId, secret } = assertPlaidCredentials();

  const configuration = new Configuration({
    basePath: PlaidEnvironments[environment],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret
      }
    }
  });

  return new PlaidApi(configuration);
};

export const getPlaidProducts = (): Products[] => {
  const configuredProducts = process.env.PLAID_PRODUCTS?.trim();
  if (!configuredProducts) {
    return [Products.Transactions];
  }

  return configuredProducts
    .split(",")
    .map((product) => product.trim())
    .filter(Boolean) as Products[];
};

export const getPlaidCountryCodes = (): CountryCode[] => {
  const configuredCountryCodes = process.env.PLAID_COUNTRY_CODES?.trim();
  if (!configuredCountryCodes) {
    return [CountryCode.Us];
  }

  return configuredCountryCodes
    .split(",")
    .map((countryCode) => countryCode.trim().toUpperCase())
    .filter(Boolean) as CountryCode[];
};
