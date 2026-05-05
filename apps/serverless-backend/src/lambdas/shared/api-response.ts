import { APIGatewayProxyResult } from "aws-lambda";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};

export const ok = <T>(data: T, statusCode: number = 200): APIGatewayProxyResult => ({
  statusCode,
  headers,
  body: JSON.stringify({
    success: true,
    data
  })
});

export const fail = (
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): APIGatewayProxyResult => ({
  statusCode,
  headers,
  body: JSON.stringify({
    success: false,
    error: {
      code,
      message,
      details
    }
  })
});
