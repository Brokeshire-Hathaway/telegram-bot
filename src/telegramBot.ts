import { Bot } from "grammy";
import { ChatbotBody, chatGippity } from "./chatgpt.js";
import { limit } from "@grammyjs/ratelimiter";
import { newGroupAddMessage, promoMessage, sponsoredMessage } from "./config.js";
import { ChatCompletionMessageParam } from "openai/resources/index";
import MarkdownIt from "markdown-it";
import { ChatFromGetChat } from "grammy/types";

const promoText = `_・${promoMessage} – ${sponsoredMessage}・_`

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
    await emberReply(ctx, ctx.message?.text ?? "", undefined, promoText);
  });

  groupBot.on("message:text", async (ctx) => {
    const replyMessageUsername = ctx.message?.reply_to_message?.from?.username;
    const replyMessageIsEmber = replyMessageUsername === (process.env.NODE_ENV === 'development' ? "Ember_dev_bot" : "EmberAIBot");
    if (!replyMessageIsEmber) return;

    const messageText = ctx.message?.text;
    const replyText = ctx.message?.reply_to_message?.text;
    await emberReply(ctx, messageText, replyText, promoText);
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

  privateBot.on("message:text", async (ctx) => {
    await emberReply(ctx, ctx.message.text, undefined, promoText);
  });

  bot.start(); // Promise only resolves when bot stops
}

async function emberReply(ctx: any, userContent: string, assistantContent?: string, promoText?: string) {
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

  sendFormattedMessage(ctx, ctx.chat.id, replyMessage);
}

async function formatForTelegram(markdown: string) {
  const md = new MarkdownIt("zero")
    .enable(["emphasis", "link", "linkify", "strikethrough", "fragments_join"]);
  const html = md.renderInline(markdown);
  return html;
}

async function sendFormattedMessage(ctx: any, chatId: number, markdownMessage: string) {
  try {
    const formattedMessage = await formatForTelegram(markdownMessage);
    ctx.api.sendMessage(chatId, formattedMessage, { parse_mode: "HTML", disable_web_page_preview: true });
  } catch (error) {
    console.error(error);
    ctx.api.sendMessage(chatId, markdownMessage, { disable_web_page_preview: true });
  }
}
