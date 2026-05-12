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
exports.TransferWorkflow = void 0;
const constructs_1 = require("constructs");
const lambda = __importStar(require("aws-cdk-lib/aws-lambda-nodejs"));
const lambda_core = __importStar(require("aws-cdk-lib/aws-lambda"));
const sfn = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const path = __importStar(require("path"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class TransferWorkflow extends constructs_1.Construct {
    stateMachine;
    constructor(scope, id, props) {
        super(scope, id);
        // Shared environment and SSM prefix for Plaid secrets lookup
        const ssmPrefix = process.env.PLAID_SSM_PREFIX || '/banking-bento/plaid';
        const localstackEndpoint = process.env.LOCALSTACK_ENDPOINT || process.env.AWS_ENDPOINT_URL || '';
        const environmentVars = {
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
exports.TransferWorkflow = TransferWorkflow;
