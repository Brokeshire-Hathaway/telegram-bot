import { Composer } from "grammy";
import {
  CODE_REDEEMED_SUCCESS,
  HELP_MESSAGE,
  START_MESSAGE,
  SUCCESS_FUND_MESSAGE,
} from "./messages";
import { MyContext, sendFormattedMessage, whiteListMiddleware } from "./common";
import { isUserAdmin, redeemCode } from "../publicApi/user";

commands.command("start", async (ctx) =>
  whiteListMiddleware(
    ctx,
    async (ctx) => await sendFormattedMessage(ctx, START_MESSAGE),
  ),
);

commands.command("help", async (ctx) =>
  whiteListMiddleware(
    ctx,
    async (ctx) => await sendFormattedMessage(ctx, HELP_MESSAGE),
  ),
);
commands.command("join", async (ctx) => {
  if (!ctx.from) return;
  if (!ctx.from.username) {
    return await ctx.reply("You must set a Telegram username to join Ember.");
  }

  let user;
  try {
    user = await redeemCode(ctx.from.id, ctx.from.username, ctx.match);
  } catch (error) {
    console.log(error);
    return await ctx.reply("Code redemption failed");
  }

  await sendFormattedMessage(ctx, CODE_REDEEMED_SUCCESS(user.codes));
  return await sendFormattedMessage(ctx, START_MESSAGE);
});

