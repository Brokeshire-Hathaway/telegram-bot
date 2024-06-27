import { Composer } from "grammy";
import {
  CODE_REDEEMED_SUCCESS,
  HELP_MESSAGE,
  START_MESSAGE,
  SUCCESS_FUND_MESSAGE,
} from "./messages";
import { MyContext, sendFormattedMessage, whiteListMiddleware } from "./common";

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
