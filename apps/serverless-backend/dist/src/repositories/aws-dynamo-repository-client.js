"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsDynamoRepositoryClient = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
class AwsDynamoRepositoryClient {
    client;
    constructor() {
        const endpoint = process.env.DYNAMODB_ENDPOINT;
        const region = process.env.AWS_REGION ?? "us-east-1";
        const baseClient = new client_dynamodb_1.DynamoDBClient({
            region,
            endpoint
        });
        this.client = lib_dynamodb_1.DynamoDBDocumentClient.from(baseClient);
    }
    async put(params) {
        await this.client.send(new lib_dynamodb_1.PutCommand(params));
    }
    async get(params) {
        const output = await this.client.send(new lib_dynamodb_1.GetCommand(params));
        return { Item: output.Item };
    }
    async query(params) {
        const output = await this.client.send(new lib_dynamodb_1.QueryCommand(params));
        return { Items: output.Items };
    }
    async update(params) {
        const output = await this.client.send(new lib_dynamodb_1.UpdateCommand(params));
        return { Attributes: output.Attributes };
    }
}
exports.AwsDynamoRepositoryClient = AwsDynamoRepositoryClient;
