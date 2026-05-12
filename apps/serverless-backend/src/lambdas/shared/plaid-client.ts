import {
  SSMClient,
  GetParametersCommand,
} from "@aws-sdk/client-ssm";
import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from "plaid";

// ---------------------------------------------------------------------------
// SSM client — points to LocalStack when LOCALSTACK_ENDPOINT is set
// ---------------------------------------------------------------------------
const buildSsmClient = (): SSMClient => {
  const localstackEndpoint =
    process.env.LOCALSTACK_ENDPOINT || process.env.AWS_ENDPOINT_URL;

  if (localstackEndpoint) {
    return new SSMClient({
      endpoint: localstackEndpoint,
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    });
  }

  return new SSMClient({});
};

// ---------------------------------------------------------------------------
// Credentials cache — populated once per Lambda container lifetime
// ---------------------------------------------------------------------------
interface PlaidCredentials {
  environment: PlaidEnvironmentName;
  clientId: string;
  secret: string;
}

let cachedCredentials: PlaidCredentials | null = null;

export type PlaidEnvironmentName = "sandbox" | "development" | "production";

const normalizePlaidEnvironment = (
  value: string | undefined
): PlaidEnvironmentName => {
  if (value === "development" || value === "production") return value;
  return "sandbox";
};

// ---------------------------------------------------------------------------
// SSM parameter paths
// ---------------------------------------------------------------------------
const SSM_PREFIX =
  process.env.PLAID_SSM_PREFIX || "/banking-bento/plaid";

const ssmParamName = (suffix: string) => `${SSM_PREFIX}/${suffix}`;

// ---------------------------------------------------------------------------
// Core SSM fetch
// ---------------------------------------------------------------------------
const loadCredentialsFromSsm = async (): Promise<PlaidCredentials> => {
  if (cachedCredentials) return cachedCredentials;

  const environment = normalizePlaidEnvironment(process.env.PLAID_ENV);
  const ssm = buildSsmClient();

  const { Parameters, InvalidParameters } = await ssm.send(
    new GetParametersCommand({
      Names: [
        ssmParamName("client-id"),
        ssmParamName(`secret-${environment}`),
      ],
      WithDecryption: true,
    })
  );

  if (InvalidParameters && InvalidParameters.length > 0) {
    throw new Error(
      `SSM parameters not found: ${InvalidParameters.join(", ")}. ` +
        `Run 'npm run ssm:seed' to seed LocalStack, or create real SSM parameters.`
    );
  }

  const byName = Object.fromEntries(
    (Parameters ?? []).map((p) => [p.Name!, p.Value!])
  );

  const clientId = byName[ssmParamName("client-id")];
  const secret = byName[ssmParamName(`secret-${environment}`)];

  if (!clientId || !secret) {
    throw new Error(
      `Plaid ${environment} credentials are missing in SSM at prefix "${SSM_PREFIX}". ` +
        `Expected: ${ssmParamName("client-id")} and ${ssmParamName(`secret-${environment}`)}.`
    );
  }

  cachedCredentials = { environment, clientId, secret };
  return cachedCredentials;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const getPlaidEnvironment = (): PlaidEnvironmentName =>
  normalizePlaidEnvironment(process.env.PLAID_ENV);

/**
 * Creates a configured PlaidApi client by resolving credentials from AWS SSM
 * Parameter Store. Credentials are cached in-memory after the first fetch so
 * subsequent calls within the same Lambda container are free.
 */
export const createPlaidClient = async (): Promise<PlaidApi> => {
  const { environment, clientId, secret } = await loadCredentialsFromSsm();

  const configuration = new Configuration({
    basePath:
      PlaidEnvironments[environment as keyof typeof PlaidEnvironments],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  return new PlaidApi(configuration);
};

export const getPlaidProducts = (): Products[] => {
  const configuredProducts = process.env.PLAID_PRODUCTS?.trim();
  if (!configuredProducts) return [Products.Transactions];

  return configuredProducts
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean) as Products[];
};

export const getPlaidCountryCodes = (): CountryCode[] => {
  const configuredCountryCodes = process.env.PLAID_COUNTRY_CODES?.trim();
  if (!configuredCountryCodes) return [CountryCode.Us];

  return configuredCountryCodes
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean) as CountryCode[];
};
