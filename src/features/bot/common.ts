import { ConversationFlavor } from "@grammyjs/conversations";
import { Context, SessionFlavor } from "grammy";
import MarkdownIt from "markdown-it";
import chat from "../publicApi/chat";
import { DEFAULT_EMBER_MESSAGE } from "./messages";
import { addUser, isUserWhitelisted } from "../publicApi/user";

interface MySession {}
export type MyContext = Context & SessionFlavor<MySession> & ConversationFlavor;

export async function sendResponseFromAgentTeam(
  ctx: MyContext,
  isGroup: boolean,
  username: string | undefined,
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
    const reply = await chat(
      ctx.chat.id.toString()!,
      ctx.message.text,
      isGroup,
      username,
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
  }).disable(["list", "hr"]);
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
  html = html.replace(/<br>/g, "\n");

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
      addUser(ctx.chat.id, ctx.chat.username),
      sendFormattedMessage(ctx, DEFAULT_EMBER_MESSAGE),
    ]);
    return;
  }
  if (!isWhiteListed) {
    await addUser(ctx.chat.id, ctx.chat.title, false);
  }
  return await next(ctx);
}
