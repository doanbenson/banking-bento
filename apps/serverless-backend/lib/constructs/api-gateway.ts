import { Construct } from "constructs";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";

export interface BankingApiGatewayProps {
  readonly accountsGet: lambda.IFunction;
  readonly transactionsGet: lambda.IFunction;
  readonly plaidCreateLinkToken: lambda.IFunction;
  readonly plaidSandboxCreate: lambda.IFunction;
  readonly plaidExchangeToken: lambda.IFunction;
  readonly plaidSync: lambda.IFunction;
}

export class BankingApiGateway extends Construct {
  public readonly restApi: apigw.RestApi;

  constructor(scope: Construct, id: string, props: BankingApiGatewayProps) {
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
