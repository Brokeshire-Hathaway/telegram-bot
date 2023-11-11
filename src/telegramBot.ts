import { Bot } from "grammy";
import { ChatbotBody, chatGippity } from "./chatgpt";
import { limit } from "@grammyjs/ratelimiter";

export function startTelegramBot() {
  const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

  const privateBot = bot.chatType("private");
  const groupBot = bot.chatType("group");

  bot.use(
    limit({
      timeFrame: 3000,
      limit: 1,
      onLimitExceeded: async (ctx: any) => {
        await ctx.reply("You're going to fry my circuits. 🥴 Please slow down.");
      },
    })
  );

  groupBot.on("::mention", async (ctx) => {
    const emberMention = "@emberaibot";
    if (ctx.message?.text?.toLowerCase().includes(emberMention)) return;
    await emberReply(ctx);
  });

  privateBot.on("message:text", async (ctx) => {
    await emberReply(ctx);
  });

  bot.start(); // Promise only resolves when bot stops
}

async function emberReply(ctx: any) {
  const text = ctx.message?.text;
    const chatbotBody: ChatbotBody = {
      prompt: text,
    };
    const chatResult = await chatGippity(chatbotBody);
    ctx.reply(chatResult.content ?? "**Ember is sleeping 😴**");
}
