import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as lambda_core from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';

export interface BankingWebhooksProps {
  databaseTable: dynamodb.Table;
  stateMachine: sfn.StateMachine;
}

export interface BankingApiHandlers {
  readonly accountsGet: lambda.NodejsFunction;
  readonly transactionsGet: lambda.NodejsFunction;
  readonly plaidCreateLinkToken: lambda.NodejsFunction;
  readonly plaidSandboxCreate: lambda.NodejsFunction;
  readonly plaidExchangeToken: lambda.NodejsFunction;
  readonly plaidSync: lambda.NodejsFunction;
}

export class BankingWebhooks extends Construct {
  public readonly apiHandlers: BankingApiHandlers;

  constructor(scope: Construct, id: string, props: BankingWebhooksProps) {
    super(scope, id);

    const dynamoEndpoint = process.env.DYNAMODB_ENDPOINT;

    const environmentVars = {
      TABLE_NAME: props.databaseTable.tableName,
      STATE_MACHINE_ARN: props.stateMachine.stateMachineArn,
      PLAID_ENV: process.env.PLAID_ENV || 'sandbox',
      PLAID_CLIENT_ID: process.env.PLAID_CLIENT_ID || '',
      PLAID_SECRET: process.env.PLAID_SECRET || '',
      PLAID_SECRET_SANDBOX: process.env.PLAID_SECRET_SANDBOX || '',
      PLAID_SECRET_DEVELOPMENT: process.env.PLAID_SECRET_DEVELOPMENT || '',
      PLAID_SECRET_PRODUCTION: process.env.PLAID_SECRET_PRODUCTION || '',
      PLAID_CLIENT_NAME: process.env.PLAID_CLIENT_NAME || 'Banking Bento',
      PLAID_PRODUCTS: process.env.PLAID_PRODUCTS || 'transactions',
      PLAID_COUNTRY_CODES: process.env.PLAID_COUNTRY_CODES || 'US',
      PLAID_LANGUAGE: process.env.PLAID_LANGUAGE || 'en',
      PLAID_SANDBOX_INSTITUTION_ID: process.env.PLAID_SANDBOX_INSTITUTION_ID || 'ins_109508',
      PLAID_REDIRECT_URI: process.env.PLAID_REDIRECT_URI || '',
      PLAID_WEBHOOK_URL: process.env.PLAID_WEBHOOK_URL || '',
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

    const createApiLambda = (id: string, filename: string) => {
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
