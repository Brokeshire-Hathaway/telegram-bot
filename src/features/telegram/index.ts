import { Bot, GrammyError, HttpError, session } from "grammy";
import {
  MyContext,
  sendFormattedMessage,
  sendResponseFromAgentTeam,
} from "./common";
import { ENVIRONMENT } from "../../common/settings";
import { conversations } from "@grammyjs/conversations";
import { limit } from "@grammyjs/ratelimiter";
import { commands } from "./commands";
import { walletCommands } from "./walletCommands";
import { addUserToWaitList, isUserWhitelisted } from "../user";
import { DEFAULT_EMBER_MESSAGE } from "./messages";

export function startTelegramBot() {
  const bot = new Bot<MyContext>(ENVIRONMENT.TELEGRAM_BOT_TOKEN);

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
  bot.use(commands);
  if (ENVIRONMENT.FF_EMBER_WALLET) bot.use(walletCommands);

  // Handle errors
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) {
      console.error("Error in request:", e.description);
    } else if (e instanceof HttpError) {
      console.error("Could not contact Telegram:", e);
    } else {
      console.error("Unknown error:", e);
    }
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
    const replyMessageUsername = ctx.message?.reply_to_message?.from?.username;
    if (replyMessageUsername !== ENVIRONMENT.TELEGRAM_BOT_USERNAME) return;
    if (!ctx.chat) return;
    await sendResponseFromAgentTeam(ctx, `/v1/threads/${ctx.chat.id}/group`);
  });

  const privateBot = bot.chatType("private");
  privateBot.on("message:text", async (ctx) => {
    if (!ctx.chat) return;
    if (!(await isUserWhitelisted(ctx.chat.id))) {
      await Promise.all([
        addUserToWaitList(ctx.chat.id, ctx.chat.username || ""),
        sendFormattedMessage(ctx, DEFAULT_EMBER_MESSAGE),
      ]);
      return;
    }
    await sendResponseFromAgentTeam(ctx, `/v1/threads/${ctx.chat.id}/private`);
  });

  bot.start();
}
