import { Bot, Context, SessionFlavor, session } from "grammy";
import { limit } from "@grammyjs/ratelimiter";
import { getEthSmartAccount } from "./features/wallet/index.js";
import {
  type ConversationFlavor,
  conversations,
} from "@grammyjs/conversations";
import { messageEmber } from "./features/messageEmber/messageEmber.js";
import {
  getAllAccountBalances,
  formatBalances,
} from "./features/wallet/balance.js";
import { START_MESSAGE, SUCCESS_FUND_MESSAGE } from "./messages.js";
import { fundWallet, getEmberWalletAddress } from "./features/wallet/fund.js";
import { ENVIRONMENT, readSensitiveEnv } from "./common/settings.js";

interface SessionData {}
type MyContext = Context & SessionFlavor<SessionData> & ConversationFlavor;

export function startTelegramBot() {
  const bot = new Bot<MyContext>(readSensitiveEnv("TELEGRAM_BOT_TOKEN")!);

  bot.use(session());
  bot.use(conversations());
  bot.use(
    limit({
      timeFrame: 3000,
      limit: 1,
      onLimitExceeded: async (ctx) => {
        await ctx.reply(
          "You're going to fry my circuits. 🥴 Please slow down.",
        );
      },
    }),
  );

  bot.command("start", async (ctx) => {
    if (!ctx.from) return;
    return await sendFormattedMessage(ctx, START_MESSAGE);
  });

  bot.command("address", async (ctx) => {
    if (!ctx.from) return;
    const smartAccount = await getEthSmartAccount(ctx.from.id.toString());
    await ctx.reply(await smartAccount.getAccountAddress());
  });

  bot.command("emberWalletAddress", async (ctx) => {
    await ctx.reply(await getEmberWalletAddress());
  });

  bot.command("fund", async (ctx) => {
    if (!ctx.from || !ctx.from.username) return;
    let transactionUrl;
    try {
      transactionUrl = await fundWallet(
        ctx.from.id.toString(),
        ctx.from.username,
        ctx.match,
      );
    } catch (error) {
      return ctx.reply(`Failed funding wallet: ${error}`);
    }
    return await ctx.api.sendMessage(
      ctx.from.id,
      SUCCESS_FUND_MESSAGE(transactionUrl),
    );
  });

  bot.command("balance", async (ctx) => {
    if (!ctx.from) return;
    await sendFormattedMessage(
      ctx,
      "_Searching for the information you requested_",
    );
    const balances = await getAllAccountBalances(ctx.from.id.toString());
    const markdownBalances = formatBalances(balances);
    const message =
      markdownBalances.length === 0
        ? "Could not find any token in your accounts"
        : markdownBalances;
    await sendFormattedMessage(ctx, message);
  });

  const groupBot = bot.chatType(["group", "supergroup"]);
  const emberUserRegex = new RegExp(
    `.*@${ENVIRONMENT.TELEGRAM_BOT_USERNAME}.*`,
    "i",
  );
  groupBot.hears(emberUserRegex, async (ctx) => {
    if (!ctx.chat) return;
    await sendResponseFromAgentTeam(ctx, `/v1/threads/${ctx.chat.id}/group`);
  });
  groupBot.on("message:text", async (ctx) => {
    if (!ctx.chat) return;
    await sendResponseFromAgentTeam(ctx, `/v1/threads/${ctx.chat.id}/group`);
  });

  const privateBot = bot.chatType("private");
  privateBot.on("message:text", async (ctx) => {
    if (!ctx.chat) return;
    await sendResponseFromAgentTeam(ctx, `/v1/threads/${ctx.chat.id}/private`);
  });

  bot.start();
}

async function sendResponseFromAgentTeam(ctx: MyContext, endpoint: string) {
  let messageId: number | undefined;

  const onActivity = async (messageText: string) => {
    if (!messageId) {
      try {
        const message = await sendFormattedMessage(ctx, messageText);
        if (!message) return;
        messageId = message.message_id;
        return;
      } catch (error) {
        console.error(error);
        return await ctx.reply("Error sending activity update");
      }
    }

    try {
      editFormattedMessage(ctx, messageText, messageId);
    } catch (error) {
      console.warn(`Error editing message: ${error}`);
    }
  };

  if (!ctx.from || !ctx.message || !ctx.message.text) return;

  try {
    const reply = await messageEmber(
      ctx.from.id.toString()!,
      ctx.message.text,
      endpoint,
      onActivity,
    );
    await sendFormattedMessage(ctx, reply);
  } catch (error) {
    console.error(error);
    await sendFormattedMessage(
      ctx,
      `Error: ${error instanceof Error ? error.message : error}`,
    );
  }
}

async function editFormattedMessage(
  ctx: MyContext,
  message: string,
  messageId: number,
) {
  if (!ctx.from) return;
  return await ctx.api.editMessageText(
    ctx.from.id,
    messageId,
    formatForMarkdownV2(message),
    {
      parse_mode: "MarkdownV2",
    },
  );
}

async function sendFormattedMessage(ctx: MyContext, message: string) {
  if (!ctx.chat) return;
  return await ctx.api.sendMessage(ctx.chat.id, formatForMarkdownV2(message), {
    parse_mode: "MarkdownV2",
  });
}

const TELEGRAM_SPECIAL_CHARACTERS = [".", "!", "+", "-"];
function formatForMarkdownV2(messages: string): string {
  let message = messages;
  for (const specialChar of TELEGRAM_SPECIAL_CHARACTERS) {
    message = message.replaceAll(specialChar, `\\${specialChar}`);
  }
  return message;
}
