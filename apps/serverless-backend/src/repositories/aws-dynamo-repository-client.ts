import {
  DynamoDBClient,
  GetItemCommandInput,
  PutItemCommandInput,
  QueryCommandInput,
  UpdateItemCommandInput
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import {
  DynamoRepositoryClient,
  GetItemInput,
  PutItemInput,
  QueryItemsInput,
  UpdateItemInput
} from "./client";

export class AwsDynamoRepositoryClient implements DynamoRepositoryClient {
  private readonly client: DynamoDBDocumentClient;

  public constructor() {
    const endpoint = process.env.DYNAMODB_ENDPOINT;
    const region = process.env.AWS_REGION ?? "us-east-1";

    const baseClient = new DynamoDBClient({
      region,
      endpoint
    });
    this.client = DynamoDBDocumentClient.from(baseClient);
  }

  public async put(params: PutItemInput): Promise<void> {
    await this.client.send(new PutCommand(params as PutItemCommandInput));
  }

  public async get<TItem extends Record<string, unknown>>(
    params: GetItemInput
  ): Promise<{ Item?: TItem }> {
    const output = await this.client.send(new GetCommand(params as GetItemCommandInput));
    return { Item: output.Item as TItem | undefined };
  }

  public async query<TItem extends Record<string, unknown>>(
    params: QueryItemsInput
  ): Promise<{ Items?: TItem[] }> {
    const output = await this.client.send(new QueryCommand(params as QueryCommandInput));
    return { Items: output.Items as TItem[] | undefined };
  }

  public async update<TAttributes extends Record<string, unknown>>(
    params: UpdateItemInput
  ): Promise<{ Attributes?: TAttributes }> {
    const output = await this.client.send(new UpdateCommand(params as UpdateItemCommandInput));
    return { Attributes: output.Attributes as TAttributes | undefined };
  }
}
