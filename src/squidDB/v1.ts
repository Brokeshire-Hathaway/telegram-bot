import {
  ChainData,
  FeeCost,
  GasCost,
  RouteData,
  Squid,
  TokenData,
} from "squidv1";
import z from "zod";
import { getSmartAccountFromChainData } from "../features/wallet/index.js";
import { parseUnits } from "viem";
import { addUsdPriceToToken } from "../common/coingeckoDB.js";
import { ENVIRONMENT } from "../common/settings.js";

const squidBaseUrl = ENVIRONMENT.IS_TESTNET
  ? "https://testnet.api.squidrouter.com"
  : "https://api.squidrouter.com";

export const _v1squid = new Squid({
  baseUrl: squidBaseUrl,
});

let FUSE: Fuse<ChainData> | undefined;
export const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export async function _v1initSquid() {
  await squid.init();
  FUSE = createFUSE();
}
