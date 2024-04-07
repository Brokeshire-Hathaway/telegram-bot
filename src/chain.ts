import { ChainId } from "@biconomy/core-types";
import { Chain, polygonMumbai, sepolia } from "viem/chains";
import z from "zod";

export const Network = z.union([
  z.literal("sepolia"),
  z.literal("polygon-mumbai"),
]);
export type Network = z.infer<typeof Network>;

export function getChainId(network: Network): ChainId {
  let chainId: ChainId;
  switch (network) {
    case "sepolia":
      chainId = 11155111 as ChainId;
      break;
    case "polygon-mumbai":
      chainId = 80001 as ChainId;
      break;
  }
  return chainId;
}

export function getRpcUrl(network: Network): string {
  switch (network) {
    case "sepolia":
      return "https://rpc2.sepolia.org";
    case "polygon-mumbai":
      return "https://polygon-mumbai-bor-rpc.publicnode.com";
  }
}

export function getViemChain(network: Network): Chain {
  switch (network) {
    case "sepolia":
      return sepolia;
    case "polygon-mumbai":
      return polygonMumbai;
  }
}
