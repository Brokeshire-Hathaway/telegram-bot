import { Bot, GrammyError, HttpError, session } from "grammy";
import {
  MyContext,
  sendResponseFromAgentTeam,
  whiteListMiddleware,
} from "./common";
import { ENVIRONMENT } from "../../common/settings";
import { conversations, createConversation } from "@grammyjs/conversations";
import { commands } from "./commands";
import newIntegration from "./newIntegration";

export function startTelegramBot() {
  const bot = new Bot<MyContext>(ENVIRONMENT.TELEGRAM_BOT_TOKEN);
  bot.use(session({ type: "multi", conversation: {} }));
  bot.use(conversations());
  bot.use(createConversation(newIntegration, "integration"));
  bot.use(commands);

  const groupBot = bot.chatType(["group", "supergroup"]);
  const brokeshireUserRegex = new RegExp(
    `.*@${ENVIRONMENT.TELEGRAM_BOT_USERNAME}.*`,
    "i",
  );
  groupBot.hears(brokeshireUserRegex, async (ctx) =>
    whiteListMiddleware(
      ctx,
      async (ctx) => {
        if (!ctx.chat || !ctx.message.text) return;
        await sendResponseFromAgentTeam(
          ctx,
          ctx.message.text,
          "chat",
          true,
          ctx.chat.title,
        );
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
        await sendResponseFromAgentTeam(
          ctx,
          ctx.message.text,
          "chat",
          true,
          ctx.chat.title,
        );
      },
      true,
    ),
  );

  const privateBot = bot.chatType("private");
  privateBot.on("callback_query:data", async (ctx) => {
    await ctx.answerCallbackQuery(); // remove loading animation
    console.warn("Unhandled callback_query:data", ctx.callbackQuery.data);
    whiteListMiddleware(ctx, async (ctx) => {
      if (!ctx.chat) return;
      // Extract the text before the colon
      const [type, value] = ctx.callbackQuery.data.split(":");
      console.log("\n=== callback_query:data ===\n", {
        full: ctx.callbackQuery.data,
        type,
        value,
      });

      switch (type) {
        case "intent":
          await sendResponseFromAgentTeam(
            ctx,
            value,
            "intent",
            false,
            ctx.from.username,
          );
          break;
        case "expression":
          await sendResponseFromAgentTeam(
            ctx,
            value,
            "expression",
            false,
            ctx.from.username,
          );
          break;
        default:
          await sendResponseFromAgentTeam(
            ctx,
            ctx.callbackQuery.data,
            "chat",
            false,
            ctx.from.username,
          );
          break;
      }
    });
  });
  privateBot.on("message:text", async (ctx) =>
    whiteListMiddleware(ctx, async (ctx) => {
      console.log("\n=== message:text ===\n", ctx.message.text);
      if (!ctx.chat) return;
      await sendResponseFromAgentTeam(
        ctx,
        ctx.message.text,
        "chat",
        false,
        ctx.from.username,
      );
    }),
  );

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

  bot.start();
}
