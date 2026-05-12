"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BankingWebhooks = void 0;
const constructs_1 = require("constructs");
const lambda = __importStar(require("aws-cdk-lib/aws-lambda-nodejs"));
const lambda_core = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const cdk = __importStar(require("aws-cdk-lib"));
const path = __importStar(require("path"));
class BankingWebhooks extends constructs_1.Construct {
    apiHandlers;
    constructor(scope, id, props) {
        super(scope, id);
        // -----------------------------------------------------------------------
        // LocalStack / endpoint config
        // -----------------------------------------------------------------------
        const dynamoEndpoint = process.env.DYNAMODB_ENDPOINT;
        const localstackEndpoint = process.env.LOCALSTACK_ENDPOINT || process.env.AWS_ENDPOINT_URL || '';
        // SSM prefix — the path under which Plaid credentials live in Parameter Store.
        // Lambdas use this env var to know where to look; the actual secret values are
        // never baked into the Lambda environment.
        const ssmPrefix = process.env.PLAID_SSM_PREFIX || '/banking-bento/plaid';
        // -----------------------------------------------------------------------
        // Non-secret environment variables injected into every Lambda.
        // Plaid credentials (client-id, secrets) are intentionally excluded here;
        // they are resolved at runtime via SSM.
        // -----------------------------------------------------------------------
        const environmentVars = {
            TABLE_NAME: props.databaseTable.tableName,
            STATE_MACHINE_ARN: props.stateMachine.stateMachineArn,
            // Tells each Lambda which SSM prefix to use when fetching credentials.
            PLAID_SSM_PREFIX: ssmPrefix,
            // Non-secret config that is fine to keep in the environment.
            PLAID_ENV: process.env.PLAID_ENV || 'sandbox',
            PLAID_CLIENT_NAME: process.env.PLAID_CLIENT_NAME || 'Banking Bento',
            PLAID_PRODUCTS: process.env.PLAID_PRODUCTS || 'transactions',
            PLAID_COUNTRY_CODES: process.env.PLAID_COUNTRY_CODES || 'US',
            PLAID_LANGUAGE: process.env.PLAID_LANGUAGE || 'en',
            PLAID_SANDBOX_INSTITUTION_ID: process.env.PLAID_SANDBOX_INSTITUTION_ID || 'ins_109508',
            PLAID_REDIRECT_URI: process.env.PLAID_REDIRECT_URI || '',
            PLAID_WEBHOOK_URL: process.env.PLAID_WEBHOOK_URL || '',
            ...(dynamoEndpoint ? { DYNAMODB_ENDPOINT: dynamoEndpoint } : {}),
            // Allows the SSM client inside the Lambda to point to LocalStack.
            ...(localstackEndpoint ? { LOCALSTACK_ENDPOINT: localstackEndpoint } : {}),
        };
        // -----------------------------------------------------------------------
        // IAM policy: allows Lambdas to read Plaid params from SSM.
        // -----------------------------------------------------------------------
        const ssmReadPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['ssm:GetParameter', 'ssm:GetParameters'],
            // Scope to just the Plaid prefix to follow least-privilege.
            resources: [
                `arn:aws:ssm:*:*:parameter${ssmPrefix}`,
                `arn:aws:ssm:*:*:parameter${ssmPrefix}/*`,
            ],
        });
        // -----------------------------------------------------------------------
        // Lambda defaults
        // -----------------------------------------------------------------------
        const nodejsFunctionDefaults = {
            runtime: lambda_core.Runtime.NODEJS_20_X,
            bundling: {
                // Both @aws-sdk/* packages are available in the Lambda runtime —
                // externalising them keeps the bundle small and avoids version conflicts.
                externalModules: ['@aws-sdk/*'],
            },
        };
        // -----------------------------------------------------------------------
        // 1. Plaid Webhook ingress (not a Plaid-API caller, no SSM needed)
        // -----------------------------------------------------------------------
        const plaidLambda = new lambda.NodejsFunction(this, 'PlaidWebhook', {
            entry: path.join(__dirname, '../../src/lambdas/plaid-webhook-ingress.ts'),
            environment: environmentVars,
            ...nodejsFunctionDefaults,
        });
        const plaidUrl = plaidLambda.addFunctionUrl({ authType: lambda_core.FunctionUrlAuthType.NONE });
        // 2. Grant table + state-machine permissions to the webhook ingress.
        props.databaseTable.grantReadWriteData(plaidLambda);
        props.stateMachine.grantStartExecution(plaidLambda);
        // -----------------------------------------------------------------------
        // 3. Factory for API Lambdas
        // -----------------------------------------------------------------------
        const createApiLambda = (id, filename, needsSsm = false) => {
            const fn = new lambda.NodejsFunction(this, id, {
                entry: path.join(__dirname, '../../src/lambdas/', filename),
                environment: environmentVars,
                ...nodejsFunctionDefaults,
            });
            props.databaseTable.grantReadWriteData(fn);
            if (needsSsm) {
                fn.addToRolePolicy(ssmReadPolicy);
            }
            return fn;
        };
        // -----------------------------------------------------------------------
        // 4. API Lambdas — Plaid-facing ones get SSM access.
        // -----------------------------------------------------------------------
        const accountsGet = createApiLambda('ApiAccountsGet', 'api-accounts-get.ts');
        const transactionsGet = createApiLambda('ApiTransactionsGet', 'api-transactions-get.ts');
        const plaidCreateLinkToken = createApiLambda('ApiPlaidCreateLinkToken', 'api-plaid-create-link-token.ts', true);
        const plaidSandboxCreate = createApiLambda('ApiPlaidSandboxCreate', 'api-plaid-sandbox-create.ts', true);
        const plaidExchangeToken = createApiLambda('ApiPlaidExchangeToken', 'api-plaid-exchange-token.ts', true);
        const plaidSyncFn = createApiLambda('ApiPlaidSync', 'api-plaid-sync.ts');
        const transfersPostFn = createApiLambda('ApiTransfersPost', 'api-transfers-post.ts');
        // Grant Step Functions start-execution permission to the transfers lambda
        props.stateMachine.grantStartExecution(transfersPostFn);
        this.apiHandlers = {
            accountsGet,
            transactionsGet,
            plaidCreateLinkToken,
            plaidSandboxCreate,
            plaidExchangeToken,
            plaidSync: plaidSyncFn,
            transfersPost: transfersPostFn,
        };
        plaidLambda.addEnvironment('PLAID_SYNC_LAMBDA_NAME', plaidSyncFn.functionName);
        plaidSyncFn.grantInvoke(plaidLambda);
        // 5. Output the webhook URL for Plaid dashboard / local testing.
        new cdk.CfnOutput(this, 'PlaidWebhookUrl', { value: plaidUrl.url });
    }
}
exports.BankingWebhooks = BankingWebhooks;
