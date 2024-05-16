import { Composer } from "grammy";
import { fundWallet, getEmberWalletAddress } from "../wallet/fund";
import { getEthSmartAccount } from "../wallet";
import { START_MESSAGE, SUCCESS_FUND_MESSAGE } from "./messages";
import { MyContext, sendFormattedMessage } from "./common";
import { formatBalances, getAllAccountBalances } from "../wallet/balance";

export const commands = new Composer<MyContext>();

commands.command("start", async (ctx) => {
  if (!ctx.from) return;
  return await sendFormattedMessage(ctx, START_MESSAGE);
});

commands.command("address", async (ctx) => {
  if (!ctx.from) return;
  const smartAccount = await getEthSmartAccount(ctx.from.id.toString());
  await ctx.reply(await smartAccount.getAccountAddress());
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

commands.command("balance", async (ctx) => {
  if (!ctx.from) return;
  await sendFormattedMessage(
    ctx,
    "_Searching for the information you requested_",
  );
  const balances = await getAllAccountBalances(ctx.from.id.toString());
  const markdownBalances = formatBalances(balances);
  const message =
    markdownBalances.length === 0
      ? "Could not find any token in your accounts"
      : markdownBalances;
  await sendFormattedMessage(ctx, message);
});
