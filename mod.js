const fs = require('fs');
const file = 'apps/serverless-backend/lib/constructs/webhooks.ts';
let code = fs.readFileSync(file, 'utf8');

const lambdaCreation = `
    const createApiLambda = (id, filename) => {
      const fn = new lambda.NodejsFunction(this, id, {
        entry: path.join(__dirname, '../../src/lambdas/', filename),
        environment: environmentVars,
      });
      props.databaseTable.grantReadWriteData(fn);
      const url = fn.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE, cors: { allowedOrigins: ['*'] } });
      new cdk.CfnOutput(this, id + 'Url', { value: url.url });
      return fn;
    };

    createApiLambda('ApiAccountsGet', 'api-accounts-get.ts');
    createApiLambda('ApiTransactionsGet', 'api-transactions-get.ts');
    createApiLambda('ApiPlaidCreateLinkToken', 'api-plaid-create-link-token.ts');
    createApiLambda('ApiPlaidSandboxCreate', 'api-plaid-sandbox-create.ts');
    createApiLambda('ApiPlaidExchangeToken', 'api-plaid-exchange-token.ts');
    createApiLambda('ApiPlaidSync', 'api-plaid-sync.ts');
`;

code = code.replace(
  '// 3. Output the URLs for LocalStack testing',
  '// 3. Create APIs\n' + lambdaCreation + '\n\n    // 4. Output the URLs for LocalStack testing'
);

fs.writeFileSync(file, code);
