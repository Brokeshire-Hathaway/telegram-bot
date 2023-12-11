import { Bot, Context, session } from "grammy";
import { ChatGptModel, Conversation as ConvoHistory, chatGippity, getLatestMessageText } from "./chatgpt.js";
import { limit } from "@grammyjs/ratelimiter";
import { newGroupAddMessage, promoMessage, sponsoredMessage } from "./config.js";
import { ChatCompletionMessageParam, ChatCompletionUserMessageParam } from "openai/resources/index";
import MarkdownIt from "markdown-it";
import { ChatFromGetChat, KeyboardButton, KeyboardButtonRequestUser } from "grammy/types";
import { WalletTokenBalance, getAccountAddress, getAccountBalances, prepareSendToken, truncateAddress } from "./smartAccount.js";
import { randomInt } from "crypto";
import {
  type Conversation,
  type ConversationFlavor,
  conversations,
  createConversation,
} from "@grammyjs/conversations";
import PreciseNumber from "./common/tokenMath.js";
import { send } from "process";

type MyContext = Context & ConversationFlavor;
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

  privateBot.use(createConversation(sendCrypto));

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
    await emberReply(ctx, ctx.message?.text ?? "", undefined, promoText);
  });

  groupBot.on("message:text", async (ctx) => {
    const replyMessageUsername = ctx.message?.reply_to_message?.from?.username;
    const replyMessageIsEmber = replyMessageUsername === (process.env.NODE_ENV === 'development' ? "Ember_dev_bot" : "EmberAIBot");
    if (!replyMessageIsEmber) return;

    const messageText = ctx.message?.text;
    const replyToText = ctx.message?.reply_to_message?.text;
    const replyToMessage: ChatCompletionMessageParam[] | undefined = replyToText ? [{ role: "assistant", content: replyToText }] : undefined;
    await emberReply(ctx, messageText, replyToMessage, promoText);
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
    await ctx.conversation.enter("sendCrypto");
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
    await emberReply(ctx, ctx.message.text, undefined, promoText);
  });

  bot.start(); // Promise only resolves when bot stops
}

async function sendCrypto(conversation: MyConversation, ctx: MyContext) {
  const randomInt32 = randomInt(-2147483648, 2147483647); // 32-bit signed integer
  const keyboardButtonRequestUser: KeyboardButtonRequestUser = {
    request_id: randomInt32,
    user_is_bot: false,
  };
  const keyboardButton: KeyboardButton = {
    text: "Select recipient",
    request_user: keyboardButtonRequestUser
  };
  const selectRecipientMessage = "Please select Telegram user that will receive crypto.";
  await ctx.reply(selectRecipientMessage, { reply_markup: { keyboard: [[keyboardButton]], one_time_keyboard: true }})
  const { msg: { user_shared: { user_id: userId } } } = await conversation.waitFor(":user_shared");

  // TODO: get username from user_id if it's even possible

  const accountUid = ctx.from?.id.toString()!;
  const senderAddress = await getAccountAddress(accountUid);
  const recipientAddress = await getAccountAddress(userId.toString());
  const selectTokenMessage = `Please select token to send from your wallet ||${truncateAddress(senderAddress)}|| to [${recipientAddress}](tg://user?id=${userId})`;
  await sendFormattedMessage(ctx, ctx.chat!.id, selectTokenMessage);

  const accountBalances = await getAccountBalances(senderAddress);
  const userBalancesMessage = `__Wallet Token Balances__\n\n${formatAccountBalancesUser(accountBalances)}`;
  await sendFormattedMessage(ctx, ctx.chat!.id, userBalancesMessage);

  const { msg: { text: token } } = await conversation.waitFor("message:text");

  const selectAmountMessage = "How much would you like to send?";
  await ctx.reply(selectAmountMessage);

  const { msg: { text: amount } } = await conversation.waitFor("message:text");

  /*const transactionPreviewMessage =
  `Please provide a summary of the transaction you are about to make using the format below.
  
  "You are about to send {amount} {token symbol} to [{recipient address}](tg://user?id=${userId}).
  
  Would you like to proceed with this transaction?"`;*/

  const assistantBalancesMessage = `__Wallet Token Balances__\n\n${formatAccountBalancesAssistant(accountBalances)}`;
  console.log("assistantBalancesMessage");
  console.log(assistantBalancesMessage);
  let messages: ChatCompletionMessageParam[] = [
    { role: "user", content: "Send token" },
    { role: "assistant", content: selectRecipientMessage },
    { role: "user", content: recipientAddress },
    { role: "system", content: `accountUid: ${accountUid}` },
    { role: "assistant", content: selectTokenMessage },
    { role: "assistant", content: assistantBalancesMessage }, // Supply different message to assistant than user to add more context
    { role: "user", content: token },
    { role: "assistant", content: selectAmountMessage },
    { role: "user", content: amount },
    { role: "system", content: "If the selected token has a standardization value of 'native', then the tokenAddress function parameter will not be provided." },
  ];

  const transactionPreviewMessage =
`Please provide a preview of the transaction I am about to make using the format below.

"You are about to send {amount} {token symbol} to [{recipient address}](tg://user?id=${userId})

**Subtotal・**{amount} {token symbol}
**Gas fee・**{gas fee} {token symbol}
**Total・**{total amount} {token symbol}`;
  messages = await emberReply(ctx, transactionPreviewMessage, messages, undefined, false, "gpt-3.5-turbo-1106");
  //messages.push({ role: "assistant", content: emberPreviewReply });

  const proceedMessage = "Would you like to proceed with this transaction?";
  await ctx.reply(proceedMessage);
  messages.push({ role: "assistant", content: proceedMessage });

  //messages.push({ role: "system", content: "To proceed with this transaction you must use executeTransaction with the transaction UUID parameter retrieved from sendTokenPrepare." });

  const { msg: { text: confirmation } } = await conversation.waitFor("message:text");

  messages = await emberReply(ctx, confirmation, messages, undefined, false, "gpt-3.5-turbo-1106");
  //messages.push({ role: "assistant", content: emberSendReply });
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

async function emberReply(ctx: any, userContent: string, conversationHistory?: ConvoHistory, promoText?: string, vectorSearch?: boolean, model?: ChatGptModel) {
  const userMessage: ChatCompletionUserMessageParam = { role: "user", content: userContent };
  const chatResult = await chatGippity(userMessage, conversationHistory, vectorSearch, model);
  const content = getLatestMessageText(chatResult) ?? "**Ember is sleeping 😴**";
  const replyMessage = promoText ? `${content}\n\n ${promoText}` : content;

  await sendFormattedMessage(ctx, ctx.chat.id, replyMessage);

  return chatResult;
}

function formatAccountBalancesUser(accountBalances: WalletTokenBalance[]) {
  return accountBalances.map((tokenBalance) => `**${tokenBalance.name}・$${PreciseNumber.toDecimalDisplay(tokenBalance.usdBalance, 2)}**\n└ _${PreciseNumber.toDecimalDisplay(tokenBalance.balance, undefined, tokenBalance.decimals)} ${tokenBalance.symbol}_`).join("\n\n");
}

function formatAccountBalancesAssistant(accountBalances: WalletTokenBalance[]) {
  return JSON.stringify(accountBalances.map((tokenBalance) => (
    {
      name: tokenBalance.name,
      symbol: tokenBalance.symbol,
      standardization: tokenBalance.standardization,
      tokenAddress: tokenBalance.token_address,
      balance: PreciseNumber.toDecimalDisplay(tokenBalance.balance, undefined, tokenBalance.decimals),
      usdBalance: PreciseNumber.toDecimalDisplay(tokenBalance.usdBalance, 2),
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
