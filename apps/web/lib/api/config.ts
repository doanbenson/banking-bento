const trimTrailingSlash = (value: string) => value.replace(/\/$/, '');

const resolveApiBaseUrl = () => {
  const explicitBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (explicitBaseUrl) {
    return trimTrailingSlash(explicitBaseUrl);
  }

  const localstackApiId = process.env.NEXT_PUBLIC_LOCALSTACK_API_ID?.trim();
  if (localstackApiId) {
    return `http://localhost:4566/restapis/${localstackApiId}/prod/_user_request_`;
  }

  console.warn('Missing API base URL. Falling back to http://localhost:4566. Set NEXT_PUBLIC_API_URL or NEXT_PUBLIC_LOCALSTACK_API_ID for full serverless routing.');
  return 'http://localhost:4566';
};

export const API_BASE_URL = resolveApiBaseUrl();
