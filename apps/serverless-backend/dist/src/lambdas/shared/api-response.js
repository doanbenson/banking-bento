"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fail = exports.ok = void 0;
const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
};
const ok = (data, statusCode = 200) => ({
    statusCode,
    headers,
    body: JSON.stringify({
        success: true,
        data
    })
});
exports.ok = ok;
const fail = (statusCode, code, message, details) => ({
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
exports.fail = fail;
