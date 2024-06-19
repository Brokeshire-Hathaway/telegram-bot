import { ConversationFlavor } from "@grammyjs/conversations";
import { Context, SessionFlavor } from "grammy";
import MarkdownIt from "markdown-it";
import { messageEmber } from "../messageEmber/messageEmber";
import { getUserLastMessages, telemetryChatMessage } from "../telemetry";
import { addUserToWaitList, isUserWhitelisted, whiteListUser } from "../user";
import { DEFAULT_EMBER_MESSAGE } from "./messages";
import { ENVIRONMENT } from "../../common/settings";

interface MySession {}
export type MyContext = Context & SessionFlavor<MySession> & ConversationFlavor;

export async function sendResponseFromAgentTeam(
  ctx: MyContext,
  endpoint: string,
  telemetry: boolean = false,
) {
  let messageId: number | undefined;
  let text: string | undefined;

  const onActivity = async (messageText: string) => {
    if (!messageId) {
      try {
        text = messageText;
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
      if (messageText === text) return;
      editFormattedMessage(ctx, messageText, messageId, true);
    } catch (error) {
      console.warn(`Error editing message: ${error}`);
    }
  };

  if (!ctx.chat || !ctx.message || !ctx.message.text) return;

  try {
    const lastMessages = await getUserLastMessages(
      ctx.chat.id,
      ENVIRONMENT.NUMBER_OF_MESSAGES_FOR_CONTEXT + 1,
    );
    const reply = await messageEmber(
      ctx.chat.id.toString()!,
      ctx.message.text,
      endpoint,
      onActivity,
      lastMessages.slice(1, lastMessages.length),
    );
    await sendFormattedMessage(ctx, reply);
    if (telemetry) await telemetryChatMessage(ctx.chat.id, reply, true);
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
      link_preview_options: {
        is_disabled: true,
      },
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
      link_preview_options: {
        is_disabled: true,
      },
    },
  );
}

function markdownToHtml(messages: string, italicize: boolean): string {
  const md = new MarkdownIt({
    html: true,
  }).disable(["list"]);
  let html = md.render(messages);

  // Match a closing tag, followed by one or more newlines (and optionally other whitespace), then an opening tag
  html = html.replace(
    /(<\/([^>]+)>)\s*(\n+)\s*(<([^>]+)>)/g,
    (match, closingTag, closingTagName, newlines, openingTag) => {
      return `${closingTag}${newlines}${openingTag}`;
    },
  );

  // Replace all occurrences of <p>, <h[0-9]> and </p> because Markdown-It doesn't have an easy way to disable them
  html = html.replace(/<p>/g, italicize ? "<i>" : "");
  html = html.replace(/<\/p>/g, italicize ? "</i>\n" : "\n");
  html = html.replace(/<h[0-9]>/g, "<b>");
  html = html.replace(/<\/h[0-9]>/g, "</b>");

  // Telegram specific syntax formatting
  html = html.replace(/\|\|(.*?)\|\|/g, "<tg-spoiler>$1</tg-spoiler>");
  return html;
}

type NeededContext = MyContext & {
  chat?: {
    id: number;
    username?: string;
  };
};
export async function whiteListMiddleware<T, C extends NeededContext>(
  ctx: C,
  next: (ctx: C) => Promise<T>,
  automaticWhiteList: boolean = false,
): Promise<T | undefined> {
  if (!ctx.chat) return;
  const isWhiteListed = await isUserWhitelisted(ctx.chat.id);
  if (!isWhiteListed && !automaticWhiteList) {
    await Promise.all([
      addUserToWaitList(ctx.chat.id, ctx.chat.username || ""),
      sendFormattedMessage(ctx, DEFAULT_EMBER_MESSAGE),
    ]);
    return;
  }
  if (!isWhiteListed) {
    await whiteListUser(ctx.chat.id, ctx.chat.title || "");
  }
  return await next(ctx);
}
