#!/usr/bin/env node
/**
 * Finds the local LocalStack API Gateway id and writes it into the frontend env.
 *
 * Usage:
 *   node scripts/sync-api-gateway-env.mjs
 *   node scripts/sync-api-gateway-env.mjs --api-id abc123
 *
 * Defaults:
 *   API name : BankingCoreApi
 *   Endpoint : http://localhost:4566
 *   Stage    : prod
 *   Env file : apps/web/.env.local
 */

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const parseArgs = (argv) => {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;

    const [rawKey, inlineValue] = arg.slice(2).split('=');
    const nextValue = inlineValue ?? argv[index + 1];
    if (inlineValue === undefined) index += 1;
    args[rawKey] = nextValue;
  }

  return args;
};

const args = parseArgs(process.argv.slice(2));

const apiName = args['api-name'] ?? process.env.API_GATEWAY_NAME ?? 'BankingCoreApi';
const endpoint = (
  args.endpoint ??
  process.env.LOCALSTACK_ENDPOINT ??
  process.env.AWS_ENDPOINT_URL ??
  'http://localhost:4566'
).replace(/\/$/, '');
const region = args.region ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1';
const stage = args.stage ?? process.env.API_GATEWAY_STAGE ?? 'prod';
const envFilePath = args['env-file']
  ? join(rootDir, args['env-file'])
  : join(rootDir, 'apps', 'web', '.env.local');

const parseRestApis = (raw) => {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    return parsed.items ?? parsed.Items ?? parsed.restApis ?? [];
  } catch {
    const matches = [...trimmed.matchAll(/<item>[\s\S]*?<id>(.*?)<\/id>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<\/item>/g)];
    return matches.map((match) => ({ id: match[1], name: match[2] }));
  }
};

const listWithAwsCli = () => {
  try {
    const output = execFileSync(
      'aws',
      [
        '--endpoint-url',
        endpoint,
        'apigateway',
        'get-rest-apis',
        '--region',
        region,
        '--output',
        'json',
      ],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ?? 'test',
          AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
          AWS_DEFAULT_REGION: region,
        },
      }
    );

    return parseRestApis(output);
  } catch {
    return [];
  }
};

const listWithLocalStackRest = async () => {
  try {
    const response = await fetch(`${endpoint}/restapis`, {
      headers: {
        Accept: 'application/json',
        'x-amz-date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''),
      },
    });

    if (!response.ok) return [];
    return parseRestApis(await response.text());
  } catch {
    return [];
  }
};

const findApiId = async () => {
  const explicitApiId =
    args['api-id'] ??
    process.env.NEXT_PUBLIC_LOCALSTACK_API_ID ??
    process.env.LOCALSTACK_API_ID ??
    process.env.API_GATEWAY_ID;

  if (explicitApiId) return explicitApiId;

  const apis = [...listWithAwsCli(), ...(await listWithLocalStackRest())];
  const api = apis.find((item) => item.name === apiName) ?? apis[0];

  if (!api?.id) {
    throw new Error(
      `Could not find an API Gateway id for "${apiName}" at ${endpoint}. Deploy the backend first or pass --api-id <id>.`
    );
  }

  return api.id;
};

const upsertEnvValue = (content, key, value) => {
  const line = `${key}=${value}`;
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedKey}=.*$`, 'm');

  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }

  const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  return `${content}${separator}${line}\n`;
};

const apiId = await findApiId();
const apiUrl = `${endpoint}/restapis/${apiId}/${stage}/_user_request_`;

const currentEnv = existsSync(envFilePath) ? readFileSync(envFilePath, 'utf8') : '';
let nextEnv = upsertEnvValue(currentEnv, 'NEXT_PUBLIC_LOCALSTACK_API_ID', apiId);
nextEnv = upsertEnvValue(nextEnv, 'NEXT_PUBLIC_API_URL', apiUrl);

mkdirSync(dirname(envFilePath), { recursive: true });
writeFileSync(envFilePath, nextEnv);

console.log(`[sync-api-gateway-env] API name : ${apiName}`);
console.log(`[sync-api-gateway-env] API id   : ${apiId}`);
console.log(`[sync-api-gateway-env] API URL  : ${apiUrl}`);
console.log(`[sync-api-gateway-env] Updated  : ${envFilePath}`);
