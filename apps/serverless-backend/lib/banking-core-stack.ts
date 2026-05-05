import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BankingDatabase } from './constructs/database';
import { TransferWorkflow } from './constructs/transfer-workflow';
import { BankingWebhooks } from './constructs/webhooks';
import { BankingApiGateway } from './constructs/api-gateway';

export class BankingCoreStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Build the Database
    const database = new BankingDatabase(this, 'BankingDb');

    // 2. Build the Transfer Workflow (requires the database)
    const workflow = new TransferWorkflow(this, 'TransferWorkflow', {
      databaseTable: database.table,
    });

    // 3. Build the Webhooks (requires both the database and the workflow)
    const webhooks = new BankingWebhooks(this, 'IngressWebhooks', {
      databaseTable: database.table,
      stateMachine: workflow.stateMachine,
    });

    // 4. Build the API Gateway for frontend-facing API routes.
    new BankingApiGateway(this, 'BankingApiGateway', webhooks.apiHandlers);
  }
}