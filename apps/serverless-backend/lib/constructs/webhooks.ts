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
      ...(dynamoEndpoint ? { DYNAMODB_ENDPOINT: dynamoEndpoint } : {}),
    };

    // 1. Plaid Webhook
    const plaidLambda = new lambda.NodejsFunction(this, 'PlaidWebhook', {
      entry: path.join(__dirname, '../../src/lambdas/plaid-webhook-ingress.ts'),
      environment: environmentVars,
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
