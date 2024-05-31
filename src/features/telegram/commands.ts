import { Composer } from "grammy";
import { fundWallet, getEmberWalletAddress } from "../wallet/fund";
import { START_MESSAGE, SUCCESS_FUND_MESSAGE } from "./messages";
import { MyContext, sendFormattedMessage } from "./common";

export const commands = new Composer<MyContext>();

commands.command("start", async (ctx) => {
  if (!ctx.from) return;
  return await sendFormattedMessage(ctx, START_MESSAGE);
});

commands.command("emberWalletAddress", async (ctx) => {
  await ctx.reply(await getEmberWalletAddress());
});

commands.command("fund", async (ctx) => {
  if (!ctx.from || !ctx.from.username) return;
  let transactionUrl;
  try {
    transactionUrl = await fundWallet(
      ctx.from.id.toString(),
      ctx.from.username,
      ctx.match,
    );
  } catch (error) {
    return ctx.reply(`Failed funding wallet: ${error}`);
  }
  return await ctx.api.sendMessage(
    ctx.from.id,
    SUCCESS_FUND_MESSAGE(transactionUrl),
  );
});
