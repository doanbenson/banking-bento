import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ok } from "./shared/api-response";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return ok({ access_token: "access-sandbox-" + Date.now(), item_id: "item-123" });
};
