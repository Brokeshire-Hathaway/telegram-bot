import { IBundler, Bundler } from "@biconomy/bundler";
import { ChainId } from "@biconomy/core-types";
import { DEFAULT_ENTRYPOINT_ADDRESS } from "@biconomy/account";
import z from "zod";

export const Network = z.union([
  z.literal("sepolia"),
  z.literal("axelar-testnet"),
  z.literal("osmosis-testnet"),
]);
export type Network = z.infer<typeof Network>;

export function createBundler(network: Network): IBundler {
  let chainId: ChainId;
  switch (network) {
    case "sepolia":
      chainId = 11155111 as ChainId;
    case "axelar-testnet":
      chainId = "axelar-testnet-lisbon-3" as unknown as ChainId;
    case "osmosis-testnet":
      chainId = "osmo-test-5" as unknown as ChainId;
  }
  const userOpReceiptMaxDurationIntervals = {
    chainId: 60000,
  };
  return new Bundler({
    bundlerUrl: `https://bundler.biconomy.io/api/v2/${chainId}/BBagqibhs.HI7fopYh-iJkl-45ic-afU9-6877f7gaia78Cv`,
    chainId: chainId,
    entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    userOpReceiptMaxDurationIntervals: userOpReceiptMaxDurationIntervals,
  });
}

export function getRpcUrl(network: Network): string {
  switch (network) {
    case "sepolia":
      return "https://rpc2.sepolia.org";
    case "axelar-testnet":
      return "https://rpc-axelar-testnet.imperator.co";
    case "osmosis-testnet":
      return "https://rpc.testnet.osmosis.zone";
  }
}
