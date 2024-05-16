import { ConversationFlavor } from "@grammyjs/conversations";
import { Context, SessionFlavor } from "grammy";
import MarkdownIt from "markdown-it";
import { messageEmber } from "../messageEmber/messageEmber";

interface MySession {}
export type MyContext = Context & SessionFlavor<MySession> & ConversationFlavor;

export async function sendResponseFromAgentTeam(
  ctx: MyContext,
  endpoint: string,
) {
  let messageId: number | undefined;

  const onActivity = async (messageText: string) => {
    if (!messageId) {
      try {
        const message = await sendFormattedMessage(ctx, messageText, true);
        if (!message) return;
        messageId = message.message_id;
        return;
      } catch (error) {
        console.error(error);
        return await ctx.reply("Error sending activity update");
      }
    }

    try {
      editFormattedMessage(ctx, messageText, messageId, true);
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

export async function editFormattedMessage(
  ctx: MyContext,
  message: string,
  messageId: number,
  italicize = false,
) {
  if (!ctx.from) return;
  return await ctx.api.editMessageText(
    ctx.from.id,
    messageId,
    markdownToHtml(message, italicize),
    {
      parse_mode: "HTML",
    },
  );
}

export async function sendFormattedMessage(
  ctx: MyContext,
  message: string,
  italicize = false,
) {
  if (!ctx.chat) return;
  return await ctx.api.sendMessage(
    ctx.chat.id,
    markdownToHtml(message, italicize),
    {
      parse_mode: "HTML",
    },
  );
}

function markdownToHtml(messages: string, italicize: boolean): string {
  const md = new MarkdownIt();
  let html = md.render(messages);

  // Match a closing tag, followed by one or more newlines (and optionally other whitespace), then an opening tag
  html = html.replace(
    /(<\/([^>]+)>)\s*(\n+)\s*(<([^>]+)>)/g,
    (match, closingTag, closingTagName, newlines, openingTag) => {
      return `${closingTag}${newlines}${openingTag}`;
    },
  );

  // Replace all occurrences of <p> and </p> because Markdown-It doesn't have an easy way to disable them
  html = html.replace(/<p>/g, italicize ? "<i>" : "");
  html = html.replace(/<\/p>/g, italicize ? "</i>\n" : "\n");

  // Telegram specific syntax formatting
  html = html.replace(/\|\|(.*?)\|\|/g, "<tg-spoiler>$1</tg-spoiler>");
  return html;
}
