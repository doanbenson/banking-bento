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
exports.BankingCoreStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const database_1 = require("./constructs/database");
const transfer_workflow_1 = require("./constructs/transfer-workflow");
const webhooks_1 = require("./constructs/webhooks");
const api_gateway_1 = require("./constructs/api-gateway");
class BankingCoreStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // 1. Build the Database
        const database = new database_1.BankingDatabase(this, 'BankingDb');
        // 2. Build the Transfer Workflow (requires the database)
        const workflow = new transfer_workflow_1.TransferWorkflow(this, 'TransferWorkflow', {
            databaseTable: database.table,
        });
        // 3. Build the Webhooks (requires both the database and the workflow)
        const webhooks = new webhooks_1.BankingWebhooks(this, 'IngressWebhooks', {
            databaseTable: database.table,
            stateMachine: workflow.stateMachine,
        });
        // 4. Build the API Gateway for frontend-facing API routes.
        new api_gateway_1.BankingApiGateway(this, 'BankingApiGateway', webhooks.apiHandlers);
    }
}
exports.BankingCoreStack = BankingCoreStack;
