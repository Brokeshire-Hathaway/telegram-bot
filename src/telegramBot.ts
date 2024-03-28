import { Bot, Context, SessionFlavor, session } from "grammy";
import { AiAssistantConfig, ChatGptModel, Conversation as ConvoHistory, aiAssistant, getLatestMessage, getLatestMessageText, getToolCalls, runTools } from "./chatgpt.js";
import { limit } from "@grammyjs/ratelimiter";
import { newGroupAddMessage, promoMessage, sponsoredMessage, systemMessageContent } from "./config.js";
import { ChatCompletionMessageParam, ChatCompletionTool} from "openai/resources/index";
import MarkdownIt from "markdown-it";
import { ChatFromGetChat, Message } from "grammy/types";
import { WalletTokenBalance, getAccountAddress, getAccountBalances } from "./smartAccount.js";
import {
  type Conversation,
  type ConversationFlavor,
  conversations,
} from "@grammyjs/conversations";
import PreciseNumber from "./common/tokenMath.js";
import { SendTokenCache } from "./features/sendToken/sendTokenAgent.js";
import { getMarket, tools } from "./gpttools.js";
import { messageEmber } from "./features/messageEmber/messageEmber.js";

interface SessionData {
  sendTokenCache?: SendTokenCache;
}
type MyContext = Context & SessionFlavor<SessionData> & ConversationFlavor;

const promoText = `_・${promoMessage} – ${sponsoredMessage}・_`

export function startTelegramBot() {
  const bot = new Bot<MyContext>(process.env.TELEGRAM_BOT_TOKEN!);

  bot.use(session({
    initial() {
      // return empty object for now
      return {};
    },
  }));

  bot.use(conversations());

  //bot.use(createConversation(sendToken));

  bot.use(
    limit({
      timeFrame: 3000,
      limit: 1,
      onLimitExceeded: async (ctx: any) => {
        await ctx.reply("You're going to fry my circuits. 🥴 Please slow down.");
      },
    })
  );

  bot.command("address", async (ctx) => {
    console.log(`ctx.from?.id.toString()!: ${ctx.from?.id.toString()!}`);
    const address = await getAccountAddress(ctx.from?.id.toString()!);
    await ctx.reply(address);
  });

  bot.command("balance", async (ctx) => {
    const address = await getAccountAddress(ctx.from?.id.toString()!);
    const balances = await getAccountBalances(address);
    const markdownBalances = formatAccountBalancesUser(balances);
    await sendFormattedMessage(ctx, ctx.chat!.id, markdownBalances);
  });

  const groupBot = bot.chatType(["group", "supergroup"]);

  const groupBotTools = tools.filter((tool) => tool.function.name === "getMarket");

  /*groupBot.command("address", async (ctx) => {
    console.log(`ctx.from?.id.toString()!: ${ctx.from?.id.toString()!}`);

    const address = await getAccountAddress(ctx.from?.id.toString()!);
    console.log(`address: ${address}`);

    await ctx.reply(address);
  });*/

  //const emberUserRegex = process.env.NODE_ENV === 'development' ? /.*@ember_dev_bot.*/i : /.*@emberaibot.*/i;
  const emberUserRegex = new RegExp(`.*@${process.env.TELEGRAM_BOT_USERNAME!}.*`, "i");
  groupBot.hears(emberUserRegex, async (ctx) => {
    await emberReply(ctx, ctx.message?.text ?? "", { tools: groupBotTools });
  });

  groupBot.on("::bot_command", async (ctx) => {
    const messageText = ctx.message?.text;
    if (messageText == null) return;
    await emberReply(ctx, messageText, { tools: groupBotTools });
  });

  groupBot.on("message:text", async (ctx) => {
    const replyMessageUsername = ctx.message?.reply_to_message?.from?.username;
    const replyMessageIsEmber = replyMessageUsername === process.env.TELEGRAM_BOT_USERNAME!;
    if (!replyMessageIsEmber) return;

    const messageText = ctx.message?.text;
    const replyToText = ctx.message?.reply_to_message?.text;
    const replyToMessage: ChatCompletionMessageParam[] | undefined = replyToText ? [{ role: "assistant", content: replyToText }] : undefined;
    await emberReply(ctx, messageText, { conversationHistory: replyToMessage, tools: groupBotTools });
  });

  groupBot.on("my_chat_member", async (ctx) => {
    console.log("MyChatMember.user.username");
    console.log(ctx.myChatMember.new_chat_member.user.username);
    console.log("MyChatMember");
    console.log(ctx.myChatMember);

    const newMemberUsername = ctx.myChatMember.new_chat_member.user.username;
    const newMemberIsEmber = newMemberUsername === process.env.TELEGRAM_BOT_USERNAME!;
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

  const privateBot = bot.chatType("private");

  /*privateBot.command("send", async (ctx) => {
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
  });*/

  privateBot.on("message:text", async (ctx) => {
    //await emberReply(ctx, ctx.message.text);
    let messageId: number | undefined;
    const onActivity = async (messageText: string) => {
      if (messageId == null) {
        const message = await sendFormattedMessage(ctx, ctx.chat.id, messageText, true);
        messageId = message.message_id;
      } else {
        const formattedMessage = formatForTelegram(messageText, true);
        try {
          ctx.api.editMessageText(ctx.chat.id, messageId, formattedMessage, { parse_mode: "HTML", disable_web_page_preview: true });
        } catch (error) {
          console.warn(`Error editing message: ${error}`);
        }
      }
    }
    try {
      const reply = await messageEmber(ctx.from.id.toString()!, ctx.chat.id.toString(), ctx.message.text, onActivity);
      console.log("reply");
      console.log(reply);
      await sendFormattedMessage(ctx, ctx.chat.id, reply);
    } catch (error) {
      console.error(error);
      await sendFormattedMessage(ctx, ctx.chat.id, `Error: ${error instanceof Error ? error.message : error}`);
    }
  });

  bot.start(); // Promise only resolves when bot stops
}

/*async function getRecipientTelegramId(ctx: MyContext, selectRecipientMessage: string) {
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
};*/

interface EmberReplyConfig {
  conversationHistory?: ConvoHistory;
  vectorSearch?: boolean;
  model?: ChatGptModel;
  temperature?: number;
  tools?: ChatCompletionTool[];
}

async function emberReply(ctx: MyContext, userContent: string, config?: EmberReplyConfig) {
  let conversation: ConvoHistory = [...config?.conversationHistory ?? [], { role: "user", content: userContent }];
  let aaConfig: AiAssistantConfig = {
    systemMessageContent,
    chatGptModel: config?.model ?? "gpt-4-1106-preview",
    vectorSearch: config?.vectorSearch,
    temperature: config?.temperature ?? 0.7,
    tools: config?.tools ?? tools,
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

export function formatForTelegram(markdown: string, italicize = false) {
  const md = new MarkdownIt("zero")
    .enable(["emphasis", "link", "linkify", "strikethrough", "blockquote", "fragments_join"]);
  let html = md.render(markdown);

  // Match a closing tag, followed by one or more newlines (and optionally other whitespace), then an opening tag
  html = html.replace(/(<\/([^>]+)>)\s*(\n+)\s*(<([^>]+)>)/g, (match, closingTag, closingTagName, newlines, openingTag, openingTagName) => {
    // Construct and return the replacement string with the matched tag names and the original number of newlines between the tags
    return `${closingTag}${newlines}${openingTag}`;
  });


  // Replace all occurrences of <p> and </p> because Markdown-It doesn't have an easy way to disable them
  html = html.replace(/<p>/g, italicize ? '<i>' : '');
  html = html.replace(/<\/p>/g, italicize ? '</i>\n': '\n');
  // Telegram specific syntax formatting
  html = html.replace(/\|\|(.*?)\|\|/g, '<tg-spoiler>$1</tg-spoiler>');
  return html;
}

async function sendFormattedMessage(ctx: any, chatId: number, markdownMessage: string, italicize = false): Promise<Message> {
  try {
    const formattedMessage = formatForTelegram(markdownMessage, italicize);
    return await ctx.api.sendMessage(chatId, formattedMessage, { parse_mode: "HTML", disable_web_page_preview: true });
  } catch (error) {
    console.error(error);
    return await ctx.api.sendMessage(chatId, markdownMessage, { disable_web_page_preview: true });
  }
}
