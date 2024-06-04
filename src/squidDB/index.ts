import { Token } from "@0xsquid/squid-types";
import * as squid1 from "./v1";
import * as squid2 from "./v2";
import { ENVIRONMENT, Settings } from "../common/settings";
import z from "zod";
import { ChainData as ChainDataV1 } from "squidv1";
import { ChainData as ChainDataV2 } from "@0xsquid/squid-types";
import { Chain, defineChain } from "viem";

export async function initSquid() {
  await squid1._v1initSquid();
  await squid2._v2initSquid();
}

export type TokenInformation = Token & { usdPrice: number };
type Version = z.infer<typeof Settings.shape.SQUID_DEFAULT_VERSION>;

function getVersion(version: Version | undefined) {
  return version || ENVIRONMENT.SQUID_DEFAULT_VERSION;
}

function getSquid(version: Version | undefined) {
  return getVersion(version) === 1 ? squid1._v1squid : squid2._v2squid;
}

export function getTokenByAddresAndChainId(
  chainId: string,
  tokenAddress: string,
  version: Version | undefined = undefined,
) {
  return getSquid(version).tokens.find(
    (v) => v.chainId.toString() === chainId && v.address === tokenAddress,
  );
}

export function getTokensDecimals(chainId: string, tokenAddress: string) {
  const token = getTokenByAddresAndChainId(chainId, tokenAddress);
  if (!token) return 0;
  return token.decimals;
}

const IGNORED_CHAINS = ["5", "314", "3141", "2222"];
export function getAllChains(version: Version | undefined = undefined) {
  return getSquid(version).chains.filter(
    (v) =>
      v.chainType === "evm" && !IGNORED_CHAINS.includes(v.chainId.toString()),
  );
}

type ChainData = ChainDataV1 | ChainDataV2;
const ARBITRUM_CHAIN_ID = 42161;
export function getViemChain(network: ChainData): Chain {
  const rpc =
    !ENVIRONMENT.ARBITRUM_RPC_URL || network.chainId !== ARBITRUM_CHAIN_ID
      ? network.rpc
      : ENVIRONMENT.ARBITRUM_RPC_URL;
  const chainId =
    typeof network.chainId === "number"
      ? network.chainId
      : parseInt(network.chainId);
  return defineChain({
    id: chainId,
    name: network.networkName,
    network: network.networkName,
    nativeCurrency: {
      decimals: network.nativeCurrency.decimals,
      name: network.nativeCurrency.name,
      symbol: network.nativeCurrency.symbol,
    },
    rpcUrls: {
      default: {
        http: [rpc],
      },
      public: {
        http: [rpc],
      },
    },
    blockExplorers: {
      default: {
        name: "Explorer",
        url: network.blockExplorerUrls[0],
      },
    },
  });
}
