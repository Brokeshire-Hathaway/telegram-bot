import { Bot } from "grammy";
import { ChatbotBody, Message, chatGippity } from "./chatgpt";
import { limit } from "@grammyjs/ratelimiter";

export function startTelegramBot() {
  const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

  const privateBot = bot.chatType("private");
  const groupBot = bot.chatType(["group", "supergroup"]);

  bot.use(
    limit({
      timeFrame: 3000,
      limit: 1,
      onLimitExceeded: async (ctx: any) => {
        await ctx.reply("You're going to fry my circuits. 🥴 Please slow down.");
      },
    })
  );

  const emberUserRegex = process.env.NODE_ENV === 'development' ? /.*@ember_dev_bot.*/i : /.*@emberaibot.*/i;
  groupBot.hears(emberUserRegex, async (ctx) => {
    await emberReply(ctx, ctx.message?.text ?? "");
  });

  groupBot.on("message:text", async (ctx) => {
    const replyMessageUsername = ctx.message?.reply_to_message?.from?.username;
    const replyMessageIsEmber = replyMessageUsername === (process.env.NODE_ENV === 'development' ? "Ember_dev_bot" : "EmberAIBot");
    if (!replyMessageIsEmber) return;

    const messageText = ctx.message?.text;
    //const replyObject = ctx.message?.reply_to_message;
    const replyText = ctx.message?.reply_to_message?.text;

    /*console.log("Mentioned in group");
    console.log(`Text: ${messageText}`);
    console.log(`Reply Object:`);
    console.log(replyObject);
    console.log(`Reply Text: ${replyText}`);*/

    await emberReply(ctx, messageText, replyText);
  });

  privateBot.on("message:text", async (ctx) => {
    await emberReply(ctx, ctx.message.text);
  });

  bot.start(); // Promise only resolves when bot stops
}

async function emberReply(ctx: any, userContent: string, assistantContent?: string) {
  const messages: Message[] = [
    { role: "user", content: userContent }
  ];

  if (assistantContent != null) {
    messages.unshift({ role: "assistant", content: assistantContent });
  }

  const chatbotBody: ChatbotBody = {
    messages
  };
  const chatResult = await chatGippity(chatbotBody);
  ctx.reply(chatResult.content ?? "**Ember is sleeping 😴**");
}
