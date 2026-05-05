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
exports.BankingApiGateway = void 0;
const constructs_1 = require("constructs");
const apigw = __importStar(require("aws-cdk-lib/aws-apigateway"));
const cdk = __importStar(require("aws-cdk-lib"));
class BankingApiGateway extends constructs_1.Construct {
    restApi;
    constructor(scope, id, props) {
        super(scope, id);
        this.restApi = new apigw.RestApi(this, "BankingHttpApi", {
            restApiName: "BankingCoreApi",
            deployOptions: {
                stageName: "prod"
            },
            defaultCorsPreflightOptions: {
                allowOrigins: apigw.Cors.ALL_ORIGINS,
                allowMethods: ["GET", "POST", "OPTIONS"],
                allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
            }
        });
        const api = this.restApi.root.addResource("api");
        const accounts = api.addResource("accounts");
        accounts.addMethod("GET", new apigw.LambdaIntegration(props.accountsGet));
        accounts
            .addResource("{accountId}")
            .addMethod("GET", new apigw.LambdaIntegration(props.accountsGet));
        const transactions = api.addResource("transactions");
        transactions.addMethod("GET", new apigw.LambdaIntegration(props.transactionsGet));
        const plaid = api.addResource("plaid");
        plaid
            .addResource("create-link-token")
            .addMethod("POST", new apigw.LambdaIntegration(props.plaidCreateLinkToken));
        plaid
            .addResource("exchange-token")
            .addMethod("POST", new apigw.LambdaIntegration(props.plaidExchangeToken));
        plaid
            .addResource("sandbox")
            .addResource("public_token")
            .addResource("create")
            .addMethod("POST", new apigw.LambdaIntegration(props.plaidSandboxCreate));
        plaid
            .addResource("sync-transactions")
            .addResource("{itemId}")
            .addMethod("POST", new apigw.LambdaIntegration(props.plaidSync));
        new cdk.CfnOutput(this, "ApiGatewayBaseUrl", {
            value: this.restApi.url
        });
    }
}
exports.BankingApiGateway = BankingApiGateway;
