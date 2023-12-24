import { ChatCompletionTool } from "openai/resources/index.mjs";

export type SendTokenTools = "sendTokenPreview" | "executeTransaction";

export const tools: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "sendTokenPreview",
            description: "Prepare a transaction to send a token to a recipient and return a preview of what will happen",
            parameters: {
                type: "object",
                properties: {
                    accountUid: {
                        type: "string",
                        description: "Sender account UID",
                    },
                    recipientAddress: {
                        type: "string",
                        description: "Ethereum address of the recipient",
                    },
                    amount: {
                        type: "string",
                        description: "Amount of the token to send",
                    },
                    standardization: {
                        enum: ["native", "erc20"],
                        description: "Standardization of the amount of the token to send",
                    },
                    tokenAddress: {
                        type: "string",
                        description: "Optional address of the token to send. If not specified, the native network token will be sent.",
                    },
                },
                required: ["accountUid", "recipientAddress", "amount"],
            },
        },
    }, 
    {
        type: "function",
        function: {
            name: "executeTransaction",
            description: "Execute a transaction from a transaction UUID obtained from sendTokenPreview",
            parameters: {
                type: "object",
                properties: {
                    transactionUuid: {
                        type: "string",
                        description: "UUID of the transaction to execute",
                    },
                },
                required: ["transactionUuid"],
            },
        },
    }, 
];