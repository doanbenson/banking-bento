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

 1. Start LocalStack
```npm run localstack:up```

 2. Seed Plaid credentials into SSM (reads your .env automatically)
```npm run ssm:seed```

 3. Bootstrap CDK (first time only)
```npm run backend:bootstrap:local```

 4. Deploy backend to LocalStack
```npm run backend:deploy:local```
# → Copy the API Gateway URL from CDK Outputs

 5. Paste the URL into apps/web/.env.local → NEXT_PUBLIC_API_URL=...

 6. Start the frontend (already running)
```npm run dev```

 7. Test the link token endpoint directly
```curl -X POST http://localhost:4566/restapis/<id>/prod/_user_request_/api/plaid/create-link-token \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user-test-1"}'```
