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

export class BankingWebhooks extends Construct {
  constructor(scope: Construct, id: string, props: BankingWebhooksProps) {
    super(scope, id);

    const environmentVars = {
      TABLE_NAME: props.databaseTable.tableName,
      STATE_MACHINE_ARN: props.stateMachine.stateMachineArn,
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

    // 3. Create APIs

    const createApiLambda = (id: string, filename: string) => {
      const fn = new lambda.NodejsFunction(this, id, {
        entry: path.join(__dirname, '../../src/lambdas/', filename),
        environment: environmentVars,
      });
      props.databaseTable.grantReadWriteData(fn);
      const url = fn.addFunctionUrl({ authType: lambda_core.FunctionUrlAuthType.NONE, cors: { allowedOrigins: ['*'] } });
      new cdk.CfnOutput(this, id + 'Url', { value: url.url });
      return fn;
    };

    createApiLambda('ApiAccountsGet', 'api-accounts-get.ts');
    createApiLambda('ApiTransactionsGet', 'api-transactions-get.ts');
    createApiLambda('ApiPlaidCreateLinkToken', 'api-plaid-create-link-token.ts');
    createApiLambda('ApiPlaidSandboxCreate', 'api-plaid-sandbox-create.ts');
    createApiLambda('ApiPlaidExchangeToken', 'api-plaid-exchange-token.ts');
    const plaidSyncFn = createApiLambda('ApiPlaidSync', 'api-plaid-sync.ts');

    plaidLambda.addEnvironment('PLAID_SYNC_LAMBDA_NAME', plaidSyncFn.functionName);
    plaidSyncFn.grantInvoke(plaidLambda);


    // 4. Output the URLs for LocalStack testing
    new cdk.CfnOutput(this, 'PlaidWebhookUrl', { value: plaidUrl.url });
  }
}
