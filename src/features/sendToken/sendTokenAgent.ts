import { readFileSync } from 'fs'
import url from 'url';
import path from 'path';
import { ChatCompletionCreateParams, ChatCompletionMessageParam, ChatCompletionMessageToolCall, ChatCompletionTool, ChatCompletionToolMessageParam } from "openai/resources/index.mjs";
import { AiAssistantConfig, ChatGptModel, Conversation, aiAssistant, getLatestMessage, getLatestMessageText, getToolCalls, runTools } from '../../chatgpt.js';
import { tools } from './sendTokenTools.js';
import { isAddress } from 'viem';
import { WalletTokenBalance, getAccountAddress, getAccountBalances, truncateAddress } from '../../smartAccount.js';
import { formatAccountBalancesAssistant, formatAccountBalancesUser } from '../../telegramBot.js';
import { executeTransaction, sendTokenPreview } from '../../gpttools.js';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const systemMessagePath = path.join(__dirname, 'systemMessage.md');
export const systemMessageContent = readFileSync(systemMessagePath, "utf8");
/*const systemMessage: ChatCompletionSystemMessageParam = {
    role: "system",
    content: systemMessageContent,
};*/

export interface SendTokenPreviewParams {
    accountUid: string;
    recipientAddress: `0x${string}`;
    amount: string;
    standardization: "native" | "erc20";
    tokenAddress: `0x${string}`;
};

interface SendTokenArgs {
    intent: string;
};

export interface SendTokenCache {
    senderAddress?: `0x${string}`;
    accountBalances?: WalletTokenBalance[];
    sendTokenParams?: Partial<SendTokenPreviewParams>;
    sendTokenPreview?: string;
};

const availableFunctions: { [key: string]: (...args: any) => any } = {
    sendTokenPreview,
    executeTransaction,
};

export async function sendTokenAgent(
    args: SendTokenArgs,
    accountUid: string,
    sendUserMessage: (message: string) => Promise<void>,
    receiveUserMessage: () => Promise<string>,
    getRecipientTelegramId: (selectRecipientMessage: string) => Promise<string>,
    // TODO: cache data using callback to prevent replays?
    setCache: <K extends keyof SendTokenCache, V extends SendTokenCache[K]>(key: K, value: V | Promise<V>) => Promise<V>,
    getCache: () => SendTokenCache | undefined,
) {
    const cache = getCache();

    // STAGE I: Convert intent into sendTokenPreview parameters
    //
    const senderAddress = cache?.senderAddress ?? await setCache("senderAddress", getAccountAddress(accountUid));
    const accountBalances = await setCache("accountBalances", getAccountBalances(senderAddress));
    let sendTokenParams = await setCache("sendTokenParams", getSendTokenParams(args.intent, accountUid, accountBalances));

    //console.log(`sendTokenRequest`);
    //console.log(sendTokenRequest);

    //console.log(`conversation`);
    //console.log(JSON.stringify(conversation, null, 2));

    // STAGE II: Gather additional required parameters
    //
    let conversation: Conversation = [
        { role: "system", content: systemMessageContent },
    ];

    //let sendTokenPreviewParams = JSON.parse(sendTokenParameters) as Partial<SendTokenPreviewParams>;

    console.log(`sendTokenAgent - sendTokenPreview Parameters`);
    console.log(sendTokenParams);

    let recipientTelegramId: string | undefined;
    let recipientLink: string | undefined;
    if (sendTokenParams.recipientAddress === undefined || !isAddress(sendTokenParams.recipientAddress)) {
        console.log("recipientAddress is invalid");
        const message = "Please select a recipient from your contacts or enter a valid Ethereum address.";
        console.log(`sendTokenAgent - getRecipientTelegramId`);
        recipientTelegramId = await getRecipientTelegramId(message);
        conversation.push({ role: "assistant", content: message });
        //tokenRequest.recipientAddress = await getAccountAddress(recipientTelegramId);
        console.log(`sendTokenAgent - getAccountAddress`);
        const recipientAddress = await getAccountAddress(recipientTelegramId);
        sendTokenParams.recipientAddress = recipientAddress;
        conversation.push({ role: "user", content: recipientAddress });
        recipientLink = `[${sendTokenParams.recipientAddress}](tg://user?id=${recipientTelegramId})`;
    }

    if (sendTokenParams.standardization === "erc20" && (sendTokenParams.tokenAddress === undefined || !isAddress(sendTokenParams.tokenAddress))) {
        console.log("tokenAddress is invalid");
        const selectTokenMessage = `Please select token to send from your wallet ||${truncateAddress(senderAddress)}|| to ${recipientLink ?? sendTokenParams.recipientAddress}`;
        conversation.push({ role: "assistant", content: selectTokenMessage });
        await sendUserMessage(selectTokenMessage);

        const userBalancesMessage = `__Wallet Token Balances__\n\n${formatAccountBalancesUser(accountBalances)}`;
        await sendUserMessage(userBalancesMessage);

        const token = await receiveUserMessage();
        conversation.push({ role: "user", content: token });
    }

    if (sendTokenParams.amount === undefined) {
        console.log("tokenAmount is undefined");
        const enterAmountMessage = "How much would you like to send?";
        conversation.push({ role: "assistant", content: enterAmountMessage });
        await sendUserMessage(enterAmountMessage);

        const amount = await receiveUserMessage();
        conversation.push({ role: "user", content: amount });
    }

    let latestMessage: ChatCompletionMessageParam;
    let toolCalls: ChatCompletionMessageToolCall[] | undefined;
    let toolMessages: ChatCompletionToolMessageParam[];

    // STAGE III: Execute sendTokenPreview and request confirmation
    //
    if (cache?.sendTokenPreview == null) {
        conversation.push({ role: "assistant", content: `## sendTokenPreview Parameters\n\n${JSON.stringify(sendTokenParams)}` });
        const userMessage =
`Use "sendTokenPreview" to provide a preview of the transaction I am about to make using the format below.

"You are about to send {amount} {token symbol} to [{recipient address}](tg://user?id=${recipientTelegramId})

**Subtotal・**{amount} {token symbol}
**Gas fee・**{gas fee} {token symbol}
**Total・**{total amount} {token symbol}"`;
        conversation.push({ role: "user", content: userMessage });
        conversation = await sendTokenAssistant(conversation, { tools });
        latestMessage = getLatestMessage(conversation);
        toolCalls = getToolCalls(latestMessage);
        if (toolCalls == null) throw new Error("No tool calls");
        toolMessages = await runTools(toolCalls, availableFunctions);

        console.log("sendTokenAgent - toolMessages (1)");
        console.log(toolMessages);

        conversation.push(...toolMessages);
        conversation = await sendTokenAssistant(conversation, { tools });

        const sendTokenPreview = cache?.sendTokenPreview ?? await setCache("sendTokenPreview", getLatestMessageText(conversation));
        await sendUserMessage(sendTokenPreview);

        console.log(`sendTokenAgent - conversation (2)`);
        console.log(JSON.stringify(conversation, null, 2));
    }

    // STAGE IV: Get confirmation and execute transaction
    //
    const confirmation = await receiveUserMessage();
    conversation.push({ role: "user", content: confirmation });

    conversation = await sendTokenAssistant(conversation, { tools });
    latestMessage = getLatestMessage(conversation);
    toolCalls = getToolCalls(latestMessage);
    if (toolCalls == null) throw new Error("No tool calls");
    toolMessages = await runTools(toolCalls, availableFunctions);

    console.log("sendTokenAgent - toolMessages (2)");
    console.log(toolMessages);

    conversation.push(...toolMessages);
    return getLatestMessageText(conversation);
}

export async function getSendTokenParams(intent: string, accountUid: string, accountBalances: WalletTokenBalance[]) {
    const userMessage =
`Convert my intent into sendTokenPreview JSON parameters.

- DO NOT include any additional JSON keys and ALWAYS follow comment instructions for keys and values.
- You currently don't have any tools.

---

{ intent: "${intent}", accountUid: "${accountUid}" }

## Account Token Balances
${formatAccountBalancesAssistant(accountBalances)}

## sendTokenPreview JSON Parameters
{
    // (required)
    accountUid: string,

    // NEVER make up a recipient address. DO NOT include a key and value if you only have the recipient name. Only IF you have a 42-character valid Ethereum address recipient address, the include it. (optional)
    recipientAddress?: \`0x\${string}\` | undefined,

    // A string representation of a number (optional)
    amount?: string | undefined,

    // (required)
    standardization: "native" | "erc20",

    // MUST BE a valid 42-character Ethereum address (optional)
    tokenAddress?: \`0x\${string}\` | undefined,
}`;
    let conversation: ChatCompletionMessageParam[] = [
        { role: "user", content: userMessage }
    ];

    console.log(`getSentTokenParams - conversation (1)`);
    console.log(JSON.stringify(conversation, null, 4));

    conversation = await sendTokenAssistant(conversation, { responseFormat: { type: "json_object" } });

    console.log(`getSentTokenParams - conversation (2)`);
    console.log(JSON.stringify(conversation, null, 4));

    return JSON.parse(getLatestMessageText(conversation)) as Partial<SendTokenPreviewParams>;
}

interface SendTokenAgentConfig {
    tools?: ChatCompletionTool[];
    responseFormat?: ChatCompletionCreateParams.ResponseFormat;
    chatGptModel?: ChatGptModel;
}

async function sendTokenAssistant(conversation: Conversation = [], config: SendTokenAgentConfig = {}) {
    const aaConfig: AiAssistantConfig = {
        systemMessageContent,
        chatGptModel: config.chatGptModel ?? "gpt-4-1106-preview",
        temperature: 0,
        tools: config.tools,
        seed: 42,
        responseFormat: config.responseFormat,
    };
    return aiAssistant(conversation, aaConfig);
}
