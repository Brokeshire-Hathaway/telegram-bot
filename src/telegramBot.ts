import { Bot } from "grammy";
import { ChatbotBody, chatGippity } from "./chatgpt";

export function startTelegramBot() {
  const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

  bot.on("::mention", async (ctx) => {
    console.log("=====================================");
    console.log(`Mention: `);
    console.log(ctx.message?.entities);

    const text = ctx.message?.text;

    const emberMention = "@ember_crypto_bot";
    if (!text?.toLowerCase().includes(emberMention)) return;

    const chatbotBody: ChatbotBody = {
      prompt: text,
    };
    const chatResult = await chatGippity(chatbotBody);
    ctx.reply(chatResult.content ?? "**Ember is sleeping**");
  });

  /*bot.on("message:text", async (ctx) => {
    console.log("=====================================");
    console.log(`Telegram Message: ${ctx.message.text}`);
    console.log("=====================================");
    console.log(`ctx: ${JSON.stringify(ctx)}`);

    const chatbotBody: ChatbotBody = {
      prompt: ctx.message.text,
    };
    const chatResult = await chatGippity(chatbotBody);
    ctx.reply(chatResult.content ?? "**Ember is sleeping**");
  });*/

  bot.start(); // Promise only resolves when bot stops
}
