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

1. Install dependencies

	npm install

2. Start LocalStack

	npm run localstack:up

3. Bootstrap and deploy the backend to LocalStack

	npm run backend:bootstrap:local
	npm run backend:deploy:local

4. Resolve API Gateway ID and configure frontend environment

	In PowerShell from repo root:

	$apiId = (docker exec localstack_main awslocal apigateway get-rest-apis | ConvertFrom-Json).items[0].id
	"NEXT_PUBLIC_LOCALSTACK_API_ID=$apiId" | Out-File -FilePath apps/web/.env.local -Encoding utf8

	Optional explicit base URL alternative:

	"NEXT_PUBLIC_API_URL=http://localhost:4566/restapis/$apiId/prod/_user_request_" | Out-File -FilePath apps/web/.env.local -Encoding utf8

5. Start frontend

	npm run dev

Frontend: http://localhost:3000

## API Routes

- POST /api/plaid/create-link-token
- POST /api/plaid/sandbox/public_token/create
- POST /api/plaid/exchange-token
- POST /api/plaid/sync-transactions/{itemId}
- GET /api/accounts
- GET /api/accounts/{accountId}
- GET /api/transactions

## Notes

- Frontend API client now requires serverless config via NEXT_PUBLIC_API_URL or NEXT_PUBLIC_LOCALSTACK_API_ID.
- Legacy Flask API has been removed from this workspace.


