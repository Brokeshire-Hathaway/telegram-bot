import { Squid } from "squidv2";
import z from "zod";
import { getSmartAccountFromChainData } from "../features/wallet/index.js";
import { parseUnits } from "viem";
import { addUsdPriceToToken } from "../common/coingeckoDB.js";
import {
  ChainData,
  FeeCost,
  GasCost,
  RouteRequest,
  Token,
} from "@0xsquid/squid-types";
import { ENVIRONMENT } from "../common/settings.js";

const squidBaseUrl = ENVIRONMENT.IS_TESTNET
  ? "https://testnet.v2.api.squidrouter.com"
  : "https://v2.api.squidrouter.com";

export const _v2squid = new Squid({
  baseUrl: squidBaseUrl,
  integratorId: ENVIRONMENT.SQUID_INTEGRATOR_ID,
});

export let FUSE: Fuse<ChainData> | undefined;
export const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export async function _v2initSquid() {
  await squid.init();
  FUSE = createFUSE();
}
