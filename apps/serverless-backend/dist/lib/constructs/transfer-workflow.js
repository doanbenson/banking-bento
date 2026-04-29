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
exports.TransferWorkflow = void 0;
const constructs_1 = require("constructs");
const lambda = __importStar(require("aws-cdk-lib/aws-lambda-nodejs"));
const sfn = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const path = __importStar(require("path"));
class TransferWorkflow extends constructs_1.Construct {
    stateMachine;
    constructor(scope, id, props) {
        super(scope, id);
        // 1. Define the processing Lambdas
        const processTransferLambda = new lambda.NodejsFunction(this, 'ProcessTransfer', {
            entry: path.join(__dirname, '../../src/process-transfer-leg.ts'),
            environment: { TABLE_NAME: props.databaseTable.tableName },
        });
        const compensateTransferLambda = new lambda.NodejsFunction(this, 'CompensateTransfer', {
            entry: path.join(__dirname, '../../src/compensate-transfer-leg.ts'),
            environment: { TABLE_NAME: props.databaseTable.tableName },
        });
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
