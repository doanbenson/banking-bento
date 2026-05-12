import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda_core from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface TransferWorkflowProps {
  databaseTable: dynamodb.Table;
}

export class TransferWorkflow extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: TransferWorkflowProps) {
    super(scope, id);

    // Shared environment and SSM prefix for Plaid secrets lookup
    const ssmPrefix = process.env.PLAID_SSM_PREFIX || '/banking-bento/plaid';
    const localstackEndpoint = process.env.LOCALSTACK_ENDPOINT || process.env.AWS_ENDPOINT_URL || '';

    const environmentVars: Record<string, string> = {
      TABLE_NAME: props.databaseTable.tableName,
      PLAID_SSM_PREFIX: ssmPrefix,
      PLAID_ENV: process.env.PLAID_ENV || 'sandbox',
      ...(localstackEndpoint ? { LOCALSTACK_ENDPOINT: localstackEndpoint } : {}),
    };

    const nodejsFunctionDefaults = {
      runtime: lambda_core.Runtime.NODEJS_20_X,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    };

    // IAM policy to allow reading Plaid parameters from SSM
    const ssmReadPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [
        `arn:aws:ssm:*:*:parameter${ssmPrefix}`,
        `arn:aws:ssm:*:*:parameter${ssmPrefix}/*`,
      ],
    });

    // 1. Define the processing Lambdas
    const processTransferLambda = new lambda.NodejsFunction(this, 'ProcessTransfer', {
      entry: path.join(__dirname, '../../src/lambdas/process-transfer-leg.ts'),
      environment: environmentVars,
      ...nodejsFunctionDefaults,
    });

    const compensateTransferLambda = new lambda.NodejsFunction(this, 'CompensateTransfer', {
      entry: path.join(__dirname, '../../src/lambdas/compensate-transfer-leg.ts'),
      environment: environmentVars,
      ...nodejsFunctionDefaults,
    });

    // Grant SSM read policy to lambdas that may need Plaid secrets
    processTransferLambda.addToRolePolicy(ssmReadPolicy);
    compensateTransferLambda.addToRolePolicy(ssmReadPolicy);

    // 2. Grant DB permissions to the Lambdas
    props.databaseTable.grantReadWriteData(processTransferLambda);
    props.databaseTable.grantReadWriteData(compensateTransferLambda);

    // 3. Define the Step Function
    this.stateMachine = new sfn.StateMachine(this, 'SplitTransferStateMachine', {
      definitionBody: sfn.DefinitionBody.fromFile(path.join(__dirname, '../../state-machines/split-transfer.asl.json')),
      definitionSubstitutions: {
        ProcessTransferArn: processTransferLambda.functionArn,
        CompensateTransferArn: compensateTransferLambda.functionArn,
      },
    });

    // 4. Grant Step Function permission to invoke the Lambdas
    processTransferLambda.grantInvoke(this.stateMachine);
    compensateTransferLambda.grantInvoke(this.stateMachine);
  }
}
