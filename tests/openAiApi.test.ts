import dotenv from "dotenv";
import chai from 'chai';
import { AiAssistantConfig, Conversation, aiAssistant, setOpenAiInstance } from "../src/chatgpt.js";
import { systemMessageContent } from "../src/features/sendToken/sendTokenAgent.js";
import { tools } from "../src/features/sendToken/sendTokenTools.js";

chai.should();

describe("Open AI API test", function() {
    before(async function () {
        dotenv.config();
        setOpenAiInstance();
    });

    /*it("should receive assistant response (gpt-4-1106-preview)", async function() {
        this.timeout(5000);

        let conversation: Conversation = [
            { role: "user", content: "Hello world!" },
        ];
        const aaConfig: AiAssistantConfig = {
            systemMessageContent,
            chatGptModel: "gpt-4-1106-preview",
            temperature: 0,
            tools: tools,
            seed: 42,
            responseFormat: undefined,
        };
        conversation = await aiAssistant(conversation, aaConfig);

        console.log("Open AI API test - conversation");
        console.log(JSON.stringify(conversation, null, 4));
    });

    it("should receive assistant response (gpt-3.5-turbo-1106)", async function() {
        this.timeout(5000);

        let conversation: Conversation = [
            { role: "user", content: "Hello world!" },
        ];
        const aaConfig: AiAssistantConfig = {
            systemMessageContent,
            chatGptModel: "gpt-3.5-turbo-1106",
            temperature: 0,
            tools: tools,
            seed: 42,
            responseFormat: undefined,
        };
        conversation = await aiAssistant(conversation, aaConfig);

        console.log("Open AI API test - conversation");
        console.log(JSON.stringify(conversation, null, 4));
    });

    it("should receive assistant JSON response (gpt-4-1106-preview)", async function() {
        this.timeout(5000);

        let conversation: Conversation = [
            { role: "user", content: "Hello world! in JSON" },
        ];
        const aaConfig: AiAssistantConfig = {
            systemMessageContent,
            chatGptModel: "gpt-4-1106-preview",
            temperature: 0,
            tools: tools,
            seed: 42,
            responseFormat: { type: "json_object" },
        };
        conversation = await aiAssistant(conversation, aaConfig);

        console.log("Open AI API test - conversation");
        console.log(JSON.stringify(conversation, null, 4));
    });

    it("should receive assistant JSON response (gpt-3.5-turbo-1106)", async function() {
        this.timeout(5000);

        let conversation: Conversation = [
            { role: "user", content: "Hello world! in JSON" },
        ];
        const aaConfig: AiAssistantConfig = {
            systemMessageContent,
            chatGptModel: "gpt-3.5-turbo-1106",
            temperature: 0,
            tools: tools,
            seed: 42,
            responseFormat: { type: "json_object" },
        };
        conversation = await aiAssistant(conversation, aaConfig);

        console.log("Open AI API test - conversation");
        console.log(JSON.stringify(conversation, null, 4));
    });*/
});