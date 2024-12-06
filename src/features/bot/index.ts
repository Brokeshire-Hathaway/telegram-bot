import { Bot, GrammyError, HttpError, session } from "grammy";
import {
  MyContext,
  sendResponseFromAgentTeam,
  whiteListMiddleware,
} from "./common";
import { ENVIRONMENT } from "../../common/settings";
import { conversations, createConversation } from "@grammyjs/conversations";
import { limit } from "@grammyjs/ratelimiter";
import { commands } from "./commands";
import newIntegration from "./newIntegration";

export function startTelegramBot() {
  const bot = new Bot<MyContext>(ENVIRONMENT.TELEGRAM_BOT_TOKEN);
  bot.use(session({ type: "multi", conversation: {} }));
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
  bot.use(createConversation(newIntegration, "integration"));
  bot.use(commands);

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
  groupBot.hears(emberUserRegex, async (ctx) =>
    whiteListMiddleware(
      ctx,
      async (ctx) => {
        if (!ctx.chat || !ctx.message.text) return;
        await sendResponseFromAgentTeam(ctx, true, ctx.chat.title);
      },
      true,
    ),
  );
  groupBot.on("message:text", async (ctx) =>
    whiteListMiddleware(
      ctx,
      async (ctx) => {
        if (!ctx.chat) return;
        const replyMessageUsername =
          ctx.message?.reply_to_message?.from?.username;
        if (replyMessageUsername !== ENVIRONMENT.TELEGRAM_BOT_USERNAME) {
          return;
        }
        await sendResponseFromAgentTeam(ctx, true, ctx.chat.title);
      },
      true,
    ),
  );

  const privateBot = bot.chatType("private");
  privateBot.on("message:text", async (ctx) =>
    whiteListMiddleware(ctx, async (ctx) => {
      if (!ctx.chat) return;
      await sendResponseFromAgentTeam(ctx, false, ctx.from.username);
    }),
  );

  bot.start();
}
