# Plaid Bank App

Serverless-first banking demo with a Next.js frontend and AWS CDK backend running on LocalStack for local development.

## Project Structure

- apps/web: Next.js frontend
- apps/serverless-backend: CDK infrastructure + Lambda handlers + Step Functions scaffold
- docker-compose.yml: LocalStack runtime

## Prerequisites

- Node.js 20+
- npm 10+
- Docker

## Local Development (Serverless Backend)

```
1. npm run localstack:up
2. npm run ssm:seed
3. npm run backend:bootstrap:local
4. npm run backend:deploy:local
5. npm run web:env:api
6. npm run dev
```

After that, for normal frontend testing, just keep npm run dev running and use the app.

__Run npm run ssm:seed__  
when:
LocalStack was restarted with fresh/empty data.
You changed Plaid credentials in root .env.
You changed PLAID_ENV, PLAID_PRODUCTS, or similar SSM-backed Plaid config.

__Run npm run backend:bootstrap:local__ 
rarely:
First time setting up LocalStack/CDK.
After wiping LocalStack volumes.
If CDK complains the environment is not bootstrapped.

__Run npm run backend:deploy:local__
when:
You changed Lambda code.
You changed CDK/API Gateway/DynamoDB/permissions/env vars.
You restarted LocalStack and lost the deployed stack.

__Run npm run web:env:api__
after:
Every backend deploy that might create a new API Gateway id.
Any LocalStack reset/redeploy.
You see frontend calls going to an old /restapis/<id>/... URL.