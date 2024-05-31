import { Composer } from "grammy";
import { getEthSmartAccount } from "../wallet";
import { MyContext, sendFormattedMessage } from "./common";
import { formatBalances, getAllAccountBalances } from "../wallet/balance";

export const walletCommands = new Composer<MyContext>();

walletCommands.command("address", async (ctx) => {
  if (!ctx.from) return;
  const smartAccount = await getEthSmartAccount(ctx.from.id.toString());
  await ctx.reply(await smartAccount.getAccountAddress());
});

walletCommands.command("balance", async (ctx) => {
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
