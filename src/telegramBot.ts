import { Bot, Context, SessionFlavor, session } from "grammy";
import { AiAssistantConfig, ChatGptModel, Conversation as ConvoHistory, aiAssistant, getLatestMessage, getLatestMessageText, getToolCalls, runTools } from "./chatgpt.js";
import { limit } from "@grammyjs/ratelimiter";
import { newGroupAddMessage, promoMessage, sponsoredMessage, systemMessageContent } from "./config.js";
import { ChatCompletionMessageParam, ChatCompletionUserMessageParam } from "openai/resources/index";
import MarkdownIt from "markdown-it";
import { ChatFromGetChat, KeyboardButton, KeyboardButtonRequestUser } from "grammy/types";
import { WalletTokenBalance, getAccountAddress, getAccountBalances } from "./smartAccount.js";
import { randomInt } from "crypto";
import {
  type Conversation,
  type ConversationFlavor,
  conversations,
  createConversation,
} from "@grammyjs/conversations";
import PreciseNumber from "./common/tokenMath.js";
import { SendTokenCache, sendTokenAgent } from "./features/sendToken/sendTokenAgent.js";
import { getMarket, tools } from "./gpttools.js";

interface SessionData {
  sendTokenCache?: SendTokenCache;
}
type MyContext = Context & SessionFlavor<SessionData> & ConversationFlavor;
type MyConversation = Conversation<MyContext>;

const promoText = `_・${promoMessage} – ${sponsoredMessage}・_`

export function startTelegramBot() {
  const bot = new Bot<MyContext>(process.env.TELEGRAM_BOT_TOKEN!);

  const privateBot = bot.chatType("private");
  const groupBot = bot.chatType(["group", "supergroup"]);

  privateBot.use(session({
    initial() {
      // return empty object for now
      return {};
    },
  }));

  privateBot.use(conversations());

  privateBot.use(createConversation(sendToken));

  bot.use(
    limit({
      timeFrame: 3000,
      limit: 1,
      onLimitExceeded: async (ctx: any) => {
        await ctx.reply("You're going to fry my circuits. 🥴 Please slow down.");
      },
    })
  );

  groupBot.command("address", async (ctx) => {
    console.log(`ctx.from?.id.toString()!: ${ctx.from?.id.toString()!}`);

    const address = await getAccountAddress(ctx.from?.id.toString()!);
    console.log(`address: ${address}`);

    await ctx.reply(address);
  });

  const emberUserRegex = process.env.NODE_ENV === 'development' ? /.*@ember_dev_bot.*/i : /.*@emberaibot.*/i;
  groupBot.hears(emberUserRegex, async (ctx) => {
    await emberReply(ctx, ctx.message?.text ?? "");
  });

  groupBot.on("::bot_command", async (ctx) => {
    const messageText = ctx.message?.text;
    if (messageText == null) return;
    await emberReply(ctx, messageText);
  });

  groupBot.on("message:text", async (ctx) => {
    const replyMessageUsername = ctx.message?.reply_to_message?.from?.username;
    const replyMessageIsEmber = replyMessageUsername === (process.env.NODE_ENV === 'development' ? "Ember_dev_bot" : "EmberAIBot");
    if (!replyMessageIsEmber) return;

    const messageText = ctx.message?.text;
    const replyToText = ctx.message?.reply_to_message?.text;
    const replyToMessage: ChatCompletionMessageParam[] | undefined = replyToText ? [{ role: "assistant", content: replyToText }] : undefined;
    await emberReply(ctx, messageText, { conversationHistory: replyToMessage });
  });

  groupBot.on("my_chat_member", async (ctx) => {
    console.log("MyChatMember.user.username");
    console.log(ctx.myChatMember.new_chat_member.user.username);
    console.log("MyChatMember");
    console.log(ctx.myChatMember);

    const newMemberUsername = ctx.myChatMember.new_chat_member.user.username;
    const newMemberIsEmber = newMemberUsername === (process.env.NODE_ENV === 'development' ? "Ember_dev_bot" : "EmberAIBot");
    const newMemberStatus = ctx.myChatMember.new_chat_member.status;
    const statusIsMember = newMemberStatus === "member";

    if (newMemberIsEmber && statusIsMember) {
      // Keep for server logs
      console.log("User that added Ember to group:");
      console.log(ctx.myChatMember.from);

      const chat: ChatFromGetChat & { username?: string } = await ctx.api.getChat(ctx.myChatMember.chat.id);
      const chatTitle = ctx.myChatMember.chat.title;
      const groupLink = chat.username ? `[${chatTitle}](https://t.me/${chat.username})` : `"${chatTitle}"`;
      const content = newGroupAddMessage(groupLink);
      const replyMessage = promoText ? `${content}\n\n ${promoText}` : content;
      sendFormattedMessage(ctx, Number(process.env.TELEGRAM_MAIN_CHAT_ID!), replyMessage);
    }
  });

  privateBot.command("send", async (ctx) => {
    console.log("conversation");
    console.log(ctx.conversation);
    await ctx.conversation.enter("sendToken");

    console.log("Conversation ENDED");
  });

  privateBot.command("address", async (ctx) => {
    console.log(`ctx.from?.id.toString()!: ${ctx.from?.id.toString()!}`);
    const address = await getAccountAddress(ctx.from?.id.toString()!);
    await ctx.reply(address);
  });

  privateBot.command("balance", async (ctx) => {
    const address = await getAccountAddress(ctx.from?.id.toString()!);
    const balances = await getAccountBalances(address);
    const markdownBalances = formatAccountBalancesUser(balances);
    await sendFormattedMessage(ctx, ctx.chat!.id, markdownBalances);
  });

  privateBot.on("message:text", async (ctx) => {
    await emberReply(ctx, ctx.message.text);
  });

  bot.start(); // Promise only resolves when bot stops
}

async function sendToken(conversation: MyConversation, ctx: MyContext) {
  const accountUid = ctx.from?.id.toString()!;

  const sendUserMessage = async (message: string) => {
    console.log("sendUserMessage");
    console.log(message);
    console.log("ctx.chat?.id");
    console.log(ctx.chat?.id);
    await sendFormattedMessage(ctx, ctx.chat!.id, message);
  };

  const receiveUserMessage = async () => {
    const { msg: { text } } = await conversation.waitFor("message:text");
    return text;
  };

  const getRecipientTelegramId = async (selectRecipientMessage: string) => {
    // TODO: get username from user_id if it's even possible

    const randomInt32 = randomInt(-2147483648, 2147483647); // 32-bit signed integer
    const keyboardButtonRequestUser: KeyboardButtonRequestUser = {
      request_id: randomInt32,
      user_is_bot: false,
    };
    const keyboardButton: KeyboardButton = {
      text: "Select recipient",
      request_user: keyboardButtonRequestUser
    };

    await ctx.reply(selectRecipientMessage, { reply_markup: { keyboard: [[keyboardButton]], one_time_keyboard: true }})
  
    const { msg: { user_shared: { user_id: userId } } } = await conversation.waitFor(":user_shared");
    return userId.toString();
  };

  const setCache = async <K extends keyof SendTokenCache, V extends SendTokenCache[K]>(key: K, value: V | Promise<V>) => {
    const partial: Partial<SendTokenCache> = { [key]: await value };
    conversation.session.sendTokenCache = { ...conversation.session.sendTokenCache, ...partial };
    return value;
  };

  const getCache = () => {
    return conversation.session.sendTokenCache;
  };

  //const { msg: { user_shared: { user_id: userId } } } = await conversation.waitFor(":user_shared");
  //const result = await getRecipientTelegramId();

  const result = await sendTokenAgent({ intent: ctx.msg?.text! }, accountUid, sendUserMessage, receiveUserMessage, getRecipientTelegramId, setCache, getCache);
  //const result = await conversation.external(() => sendTokenAgent({ intent: ctx.msg?.text! }, accountUid, sendUserMessage, receiveUserMessage, getRecipientTelegramId, setCache, getCache));
  //const result = await conversation.external(() => "Transaction successful!");

  // TODO: store callback function in session

  console.log(`result`);
  console.log(result);

  //ctx.session.toolResponse(undefined, new Error("Test error"));
  //ctx.session.toolResponse(result);

  //return result;

  await emberReply(ctx, result, { model: "gpt-3.5-turbo-1106" });
}

/*async function emberReply(ctx: any, userContent: string, assistantContent?: string, promoText?: string) {
  const messages: ChatCompletionMessageParam[] = [
    { role: "user", content: userContent }
  ];

  if (assistantContent != null) {
    messages.unshift({ role: "assistant", content: assistantContent });
  }

  const chatbotBody: ChatbotBody = {
    messages
  };
  const chatResult = await chatGippity(chatbotBody);
  const content = chatResult.content ?? "**Ember is sleeping 😴**";
  const replyMessage = promoText ? `${content}\n\n ${promoText}` : content;

  await sendFormattedMessage(ctx, ctx.chat.id, replyMessage);
}*/

interface EmberReplyConfig {
  conversationHistory?: ConvoHistory;
  vectorSearch?: boolean;
  model?: ChatGptModel
}

async function emberReply(ctx: MyContext, userContent: string, config?: EmberReplyConfig) {
  let conversation: ConvoHistory = [...config?.conversationHistory ?? [], { role: "user", content: userContent }];
  let aaConfig: AiAssistantConfig = {
    systemMessageContent,
    chatGptModel: config?.model ?? "gpt-4-1106-preview",
    vectorSearch: config?.vectorSearch,
    temperature: 0.7,
    tools: tools,
  };
  conversation = await aiAssistant(conversation, aaConfig);

  const latestMessage = getLatestMessage(conversation);
  const toolCalls = await getToolCalls(latestMessage);

  console.log("emberReply - toolCalls");
  console.log(toolCalls);

  if (toolCalls != null) {
    const sendToken = async () => {
      await ctx.conversation.enter("sendToken"); // Promise resolves before conversations ends
      return "NO RESPONSE";
    };
    const availableFunctions = {
      sendToken,
      getMarket
    }
    const toolMessages = (await runTools(toolCalls, availableFunctions)).filter((toolMessage) => {
      console.log("toolMessage.content");
      console.log(toolMessage.content);
      console.log(toolMessage.content != null && JSON.parse(toolMessage.content))

      if (toolMessage.content != null && JSON.parse(toolMessage.content).value === "NO RESPONSE") {
        console.log("Removing tool call from conversation");

        conversation = conversation.map((message) => {
          console.log("message");
          console.log(message);
          const updated = message.role === "assistant" ? { ...message, tool_calls: message.tool_calls?.filter((toolCall) => toolCall.id !== toolMessage.tool_call_id) } : message;
          console.log("updated");
          console.log(updated);

          return updated;
        }).filter((message) => !(message.role === "assistant" && message.tool_calls?.length === 0 && message.content == null));
        return false;
      }
    });

    if (toolMessages.length === 0) {
      return;
    }

    console.log("emberReply - toolMessages");
    console.log(JSON.stringify(toolMessages, undefined, 4));

    conversation.push(...toolMessages);

    aaConfig = {
      systemMessageContent,
      chatGptModel: "gpt-3.5-turbo-1106",
      vectorSearch: false,
      temperature: 0.7,
      tools: tools,
    };
    conversation = await aiAssistant(conversation, aaConfig);
  }



  const content = getLatestMessageText(conversation) ?? "**Ember is sleeping 😴**";
  const replyMessage = promoText ? `${content}\n\n ${promoText}` : content;

  await sendFormattedMessage(ctx, ctx.chat!.id, replyMessage);
}

export function formatAccountBalancesUser(accountBalances: WalletTokenBalance[]) {
  return accountBalances.map((tokenBalance) => `**${tokenBalance.name}${tokenBalance.usdBalance ? "・$" + PreciseNumber.toDecimalDisplay(tokenBalance.usdBalance, 2) : ""}**\n└ _${PreciseNumber.toDecimalDisplay(tokenBalance.balance, undefined, tokenBalance.decimals)} ${tokenBalance.symbol}_`).join("\n\n");
}

export function formatAccountBalancesAssistant(accountBalances: WalletTokenBalance[]) {
  return JSON.stringify(accountBalances.map((tokenBalance) => (
    {
      name: tokenBalance.name,
      symbol: tokenBalance.symbol,
      standardization: tokenBalance.standardization,
      tokenAddress: tokenBalance.token_address,
      balance: PreciseNumber.toDecimalDisplay(tokenBalance.balance, undefined, tokenBalance.decimals),
      usdBalance: tokenBalance.usdBalance ? PreciseNumber.toDecimalDisplay(tokenBalance.usdBalance, 2) : null,
    }
  )));
}

export async function formatForTelegram(markdown: string) {
  const md = new MarkdownIt("zero")
    .enable(["emphasis", "link", "linkify", "strikethrough", "fragments_join"]);
  let html = md.renderInline(markdown);
  html = html.replace(/\|\|(.*?)\|\|/g, '<tg-spoiler>$1</tg-spoiler>');
  return html;
}

async function sendFormattedMessage(ctx: any, chatId: number, markdownMessage: string) {
  try {
    const formattedMessage = await formatForTelegram(markdownMessage);
    await ctx.api.sendMessage(chatId, formattedMessage, { parse_mode: "HTML", disable_web_page_preview: true });
  } catch (error) {
    console.error(error);
    await ctx.api.sendMessage(chatId, markdownMessage, { disable_web_page_preview: true });
  }
}
