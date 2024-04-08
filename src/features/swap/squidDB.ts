import { Squid } from "@0xsquid/sdk";
import { FUSE } from "./index.js";
import Fuse from "fuse.js";

export function getNetworkInformation(networkName: string, squid: Squid) {
  const fuse =
    FUSE ||
    new Fuse(squid.chains, {
      ignoreLocation: true,
      keys: ["networkName"],
    });
  // Find minimum value by reducing array
  return fuse.search(networkName)[0].item;
}

export function getTokenInformation(
  chainId: string | number,
  coinGeckoId: string,
  squid: Squid,
) {
  return squid.tokens.find(
    (v) => v.chainId === chainId && v.coingeckoId === coinGeckoId,
  );
}
