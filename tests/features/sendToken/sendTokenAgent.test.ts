import dotenv from "dotenv";
import chai from 'chai';
import { getSendTokenParams, sendTokenAgent, systemMessageContent } from '../../../src/features/sendToken/sendTokenAgent.js';
import { setOpenAiInstance } from '../../../src/chatgpt.js';
import Moralis from "moralis";
import { getAccountAddress, getAccountBalances } from "../../../src/smartAccount.js";

chai.should();

describe("Send Token Agent", function() {
    before(async function () {
        dotenv.config();
        setOpenAiInstance();
        await Moralis.start({
            apiKey: process.env.MORALIS_API_KEY!,
        });
    });

    it("should load system message from Markdown file", async function() {
        const systemMessageLines = systemMessageContent.split("\n");
        systemMessageLines[0].should.equal("# Mission");
    });

    const accountUid = "1129320042";

    const sendUserMessage = (message: string) => {
        console.log(`---\nAssistant (to User): ${message}\n---`);
        return Promise.resolve();
    };

    const userMessages = [
        "send .0001 ether to Ray",
        "yes",
    ];
    const receiveUserMessage = () => {
        const userMessage = userMessages.shift();
        console.log(`---\nUser (to Assistant): ${userMessage}\n---`);
        return Promise.resolve(userMessage ?? "");
    };

    const getRecipientTelegramId = () => Promise.resolve("1023703414");

    /*it("should convert send token intent to valid sendTokenPreview parameters", async function(done) {
        this.timeout(20000);
        const senderAddress = await getAccountAddress(accountUid);
        const accountBalances = await getAccountBalances(senderAddress);
        const testUserIntents = [
            "send .000105 ether to Ray",
            "send 3.02 eth",
            "send Ray 00.0001 ethereum",
        ];
        let userIntent = testUserIntents.shift();
        if (userIntent == null) throw new Error("No user message");
        let response = await getSendTokenParams(userIntent, accountUid, accountBalances);
        console.log(`Test Response One:`);
        console.log(response);

        userIntent = testUserIntents.shift();
        if (userIntent == null) throw new Error("No user message");
        response = await getSendTokenParams(userIntent, accountUid, accountBalances);
        console.log(`Test Response Two:`);
        console.log(response);

        userIntent = testUserIntents.shift();
        if (userIntent == null) throw new Error("No user message");
        response = await getSendTokenParams(userIntent, accountUid, accountBalances);
        console.log(`Test Response Three:`);
        console.log(response);
    });*/
});