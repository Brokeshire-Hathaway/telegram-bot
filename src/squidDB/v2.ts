import { Squid } from "squidv2";
import Fuse from "fuse.js";
import z from "zod";
import { getSmartAccountFromChainData } from "../features/wallet/index.js";
import {
  Chain,
  PublicClient,
  createPublicClient,
  defineChain,
  http,
  parseUnits,
} from "viem";
import {
  addUsdPriceToToken,
  getCoingeckoToken,
} from "../common/coingeckoDB.js";
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

const squid = new Squid({
  baseUrl: squidBaseUrl,
  integratorId: ENVIRONMENT.SQUID_INTEGRATOR_ID,
});

export let FUSE: Fuse<ChainData> | undefined;
export const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export async function _v2initSquid() {
  await squid.init();
  FUSE = createFUSE();
}
