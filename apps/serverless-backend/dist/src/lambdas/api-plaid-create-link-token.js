"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const api_response_1 = require("./shared/api-response");
const handler = async (event) => {
    return (0, api_response_1.ok)({ link_token: "link-sandbox-" + Date.now() });
};
exports.handler = handler;
