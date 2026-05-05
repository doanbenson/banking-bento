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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BankingWebhooks = void 0;
const constructs_1 = require("constructs");
const lambda = __importStar(require("aws-cdk-lib/aws-lambda-nodejs"));
const lambda_core = __importStar(require("aws-cdk-lib/aws-lambda"));
const cdk = __importStar(require("aws-cdk-lib"));
const path = __importStar(require("path"));
class BankingWebhooks extends constructs_1.Construct {
    apiHandlers;
    constructor(scope, id, props) {
        super(scope, id);
        const dynamoEndpoint = process.env.DYNAMODB_ENDPOINT;
        const environmentVars = {
            TABLE_NAME: props.databaseTable.tableName,
            STATE_MACHINE_ARN: props.stateMachine.stateMachineArn,
            ...(dynamoEndpoint ? { DYNAMODB_ENDPOINT: dynamoEndpoint } : {}),
        };
        const nodejsFunctionDefaults = {
            runtime: lambda_core.Runtime.NODEJS_20_X,
            bundling: {
                externalModules: ['@aws-sdk/*'],
            },
        };
        // 1. Plaid Webhook
        const plaidLambda = new lambda.NodejsFunction(this, 'PlaidWebhook', {
            entry: path.join(__dirname, '../../src/lambdas/plaid-webhook-ingress.ts'),
            environment: environmentVars,
            ...nodejsFunctionDefaults,
        });
        const plaidUrl = plaidLambda.addFunctionUrl({ authType: lambda_core.FunctionUrlAuthType.NONE });
        // 2. Grant Permissions
        props.databaseTable.grantReadWriteData(plaidLambda);
        props.stateMachine.grantStartExecution(plaidLambda);
        // 3. Create API Lambdas
        const createApiLambda = (id, filename) => {
            const fn = new lambda.NodejsFunction(this, id, {
                entry: path.join(__dirname, '../../src/lambdas/', filename),
                environment: environmentVars,
                ...nodejsFunctionDefaults,
            });
            props.databaseTable.grantReadWriteData(fn);
            return fn;
        };
        const accountsGet = createApiLambda('ApiAccountsGet', 'api-accounts-get.ts');
        const transactionsGet = createApiLambda('ApiTransactionsGet', 'api-transactions-get.ts');
        const plaidCreateLinkToken = createApiLambda('ApiPlaidCreateLinkToken', 'api-plaid-create-link-token.ts');
        const plaidSandboxCreate = createApiLambda('ApiPlaidSandboxCreate', 'api-plaid-sandbox-create.ts');
        const plaidExchangeToken = createApiLambda('ApiPlaidExchangeToken', 'api-plaid-exchange-token.ts');
        const plaidSyncFn = createApiLambda('ApiPlaidSync', 'api-plaid-sync.ts');
        this.apiHandlers = {
            accountsGet,
            transactionsGet,
            plaidCreateLinkToken,
            plaidSandboxCreate,
            plaidExchangeToken,
            plaidSync: plaidSyncFn
        };
        plaidLambda.addEnvironment('PLAID_SYNC_LAMBDA_NAME', plaidSyncFn.functionName);
        plaidSyncFn.grantInvoke(plaidLambda);
        // 4. Output webhook URL for Plaid webhook configuration/testing.
        new cdk.CfnOutput(this, 'PlaidWebhookUrl', { value: plaidUrl.url });
    }
}
exports.BankingWebhooks = BankingWebhooks;
