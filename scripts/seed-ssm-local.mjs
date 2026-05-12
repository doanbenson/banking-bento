#!/usr/bin/env node
/**
 * seed-ssm-local.mjs
 *
 * Seeds Plaid credentials into LocalStack SSM Parameter Store.
 * Run this once after LocalStack starts and before deploying the backend.
 *
 * Usage:
 *   node scripts/seed-ssm-local.mjs
 *
 * The script reads from the root .env file so you never have to export
 * variables manually. LocalStack endpoint defaults to http://localhost:4566.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  SSMClient,
  PutParameterCommand,
  ParameterType,
} from '@aws-sdk/client-ssm';

// ---------------------------------------------------------------------------
// Parse the root .env file
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const envFilePath = join(__dirname, '..', '.env');

const parseEnvFile = (filePath) => {
  if (!existsSync(filePath)) {
    console.warn(`[seed-ssm] Warning: .env file not found at ${filePath}`);
    return {};
  }
  const raw = readFileSync(filePath, 'utf-8');
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.startsWith('#'))
      .map((line) => {
        const eqIdx = line.indexOf('=');
        return [line.slice(0, eqIdx).trim(), line.slice(eqIdx + 1).trim()];
      })
  );
};

const env = { ...parseEnvFile(envFilePath), ...process.env };

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const LOCALSTACK_ENDPOINT = env.LOCALSTACK_ENDPOINT || env.AWS_ENDPOINT_URL || 'http://localhost:4566';
const REGION = env.AWS_DEFAULT_REGION || 'us-east-1';
const SSM_PREFIX = env.PLAID_SSM_PREFIX || '/banking-bento/plaid';

const PLAID_ENV      = env.PLAID_ENV      || 'sandbox';
const PLAID_CLIENT_ID = env.PLAID_CLIENT_ID;
const PLAID_SECRET_SANDBOX     = env.PLAID_SECRET_SANDBOX;
const PLAID_SECRET_DEVELOPMENT = env.PLAID_SECRET_DEVELOPMENT;
const PLAID_SECRET_PRODUCTION  = env.PLAID_SECRET_PRODUCTION || env.PLAID_SECRET;

if (!PLAID_CLIENT_ID) {
  console.error('[seed-ssm] ERROR: PLAID_CLIENT_ID is not set in .env');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// SSM client pointed at LocalStack
// ---------------------------------------------------------------------------
const ssm = new SSMClient({
  endpoint: LOCALSTACK_ENDPOINT,
  region: REGION,
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});

// ---------------------------------------------------------------------------
// Upsert helper
// ---------------------------------------------------------------------------
const putParam = async (name, value, type = ParameterType.SECURE_STRING, description = '') => {
  if (!value) {
    console.warn(`[seed-ssm] Skipping ${name} — value is empty`);
    return;
  }
  await ssm.send(
    new PutParameterCommand({
      Name: name,
      Value: value,
      Type: type,
      Description: description,
      Overwrite: true,
    })
  );
  // Mask secrets in log output
  const display = type === ParameterType.SECURE_STRING
    ? value.slice(0, 4) + '***'
    : value;
  console.log(`[seed-ssm] ✓  ${name} = ${display}`);
};

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
console.log(`[seed-ssm] Seeding Plaid SSM parameters into LocalStack`);
console.log(`[seed-ssm]   Endpoint : ${LOCALSTACK_ENDPOINT}`);
console.log(`[seed-ssm]   Prefix   : ${SSM_PREFIX}`);
console.log(`[seed-ssm]   Env      : ${PLAID_ENV}`);
console.log('');

await putParam(
  `${SSM_PREFIX}/client-id`,
  PLAID_CLIENT_ID,
  ParameterType.SECURE_STRING,
  'Plaid API Client ID'
);

if (PLAID_SECRET_SANDBOX) {
  await putParam(
    `${SSM_PREFIX}/secret-sandbox`,
    PLAID_SECRET_SANDBOX,
    ParameterType.SECURE_STRING,
    'Plaid Sandbox Secret'
  );
}

if (PLAID_SECRET_DEVELOPMENT) {
  await putParam(
    `${SSM_PREFIX}/secret-development`,
    PLAID_SECRET_DEVELOPMENT,
    ParameterType.SECURE_STRING,
    'Plaid Development Secret'
  );
}

if (PLAID_SECRET_PRODUCTION) {
  await putParam(
    `${SSM_PREFIX}/secret-production`,
    PLAID_SECRET_PRODUCTION,
    ParameterType.SECURE_STRING,
    'Plaid Production Secret'
  );
}

// Store the environment name as a plain String (not secret)
await putParam(
  `${SSM_PREFIX}/env`,
  PLAID_ENV,
  ParameterType.STRING,
  'Plaid environment (sandbox | development | production)'
);

console.log('');
console.log('[seed-ssm] ✅  Done. Parameters are ready in LocalStack SSM.');
