import { Token } from "@0xsquid/squid-types";
import * as squid1 from "./v1";
import * as squid2 from "./v2";

export async function initSquid() {
  await squid1._v1initSquid();
  await squid2._v2initSquid();
}

export type TokenInformation = Token & { usdPrice: number };
