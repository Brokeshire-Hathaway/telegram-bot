import { Bot, session } from "grammy";
import { MyContext, sendResponseFromAgentTeam } from "./common";
import { ENVIRONMENT } from "../../common/settings";
import { conversations } from "@grammyjs/conversations";
import { limit } from "@grammyjs/ratelimiter";
import { commands } from "./commands";

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

  const groupBot = bot.chatType(["group", "supergroup"]);
  const emberUserRegex = new RegExp(
    `.*@${ENVIRONMENT.TELEGRAM_BOT_USERNAME}.*`,
    "i",
  );
  groupBot.on(":text").hears(emberUserRegex, async (ctx) => {
    console.log("Mention!");
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
