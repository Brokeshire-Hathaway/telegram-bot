import { Token } from "@0xsquid/squid-types";
import * as squid1 from "./v1";
import * as squid2 from "./v2";
import { ENVIRONMENT, Settings } from "../common/settings";
import z from "zod";
import { ChainData as ChainDataV1, TokenData } from "squidv1";
import { ChainData as ChainDataV2 } from "@0xsquid/squid-types";
import {
  Chain,
  PublicClient,
  createPublicClient,
  defineChain,
  http,
} from "viem";
import { address } from "./common";
import { addUsdPriceToToken, getCoingeckoToken } from "../common/coingeckoDB";
import Fuse from "fuse.js";

export type ChainData = ChainDataV1 | ChainDataV2;

const FUSE_OBJECTS: Record<Version, Fuse<ChainData> | undefined> = {
  1: undefined,
  2: undefined,
};
export async function initSquid() {
  await squid1._v1squid.init();
  FUSE_OBJECTS[1] = createFUSE();
  await squid2._v2squid.init();
  FUSE_OBJECTS[2] = createFUSE();
}

function createFUSE(version: Version | undefined = undefined) {
  const chains = getAllChains(version);
  if (chains.length === 0) return;
  return new Fuse(chains, {
    ignoreLocation: true,
    keys: ["networkName"],
  });
}

type Version = z.infer<typeof Settings.shape.SQUID_DEFAULT_VERSION>;

function getVersion(version: Version | undefined) {
  return version || ENVIRONMENT.SQUID_DEFAULT_VERSION;
}

const IGNORED_CHAINS = ["5", "314", "3141", "2222"];
export function getAllChains(version: Version | undefined = undefined) {
  return getSquid(version).chains.filter(
    (v) =>
      v.chainType === "evm" && !IGNORED_CHAINS.includes(v.chainId.toString()),
  );
}

export type TokenInformation = (Token | TokenData) & { usdPrice: number };
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

export function getViemClient(network: ChainData): PublicClient {
  return createPublicClient({
    chain: getViemChain(network),
    transport: http(),
  });
}

export async function getTokenInformation(
  chainId: string | number,
  tokenSearch: string,
  version: Version | undefined = undefined,
): Promise<TokenInformation | undefined> {
  const isAddress = await address.safeParseAsync(tokenSearch);
  if (isAddress.success) {
    const token = getSquid(version).tokens.find(
      (v) =>
        v.chainId.toString() === chainId.toString() &&
        v.address === isAddress.data,
    );
    if (!token || !token.coingeckoId) return undefined;
    return addUsdPriceToToken(token, { id: token.coingeckoId });
  }

  const coingeckoToken = await getCoingeckoToken(tokenSearch);
  if (!coingeckoToken) return undefined;
  const token = getSquid(version).tokens.find(
    (v) =>
      v.chainId.toString() === chainId.toString() &&
      v.coingeckoId === coingeckoToken.id,
  );
  if (!token) return undefined;
  return addUsdPriceToToken(token, coingeckoToken);
}

function getFuse(version: Version | undefined) {
  return FUSE_OBJECTS[getVersion(version)] || createFUSE(version);
}

export function getNetworkInformation(
  networkName: string,
  version: Version | undefined = undefined,
) {
  const fuse = getFuse(version);
  if (!fuse) return undefined;

  // Find minimum value by reducing array
  const searchNetwork = fuse.search(networkName);
  if (searchNetwork.length === 0) return undefined;
  return searchNetwork[0].item;
}
