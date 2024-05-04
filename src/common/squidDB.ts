import { ChainData, RouteData, Squid, TokenData } from "@0xsquid/sdk";
import Fuse from "fuse.js";
import z from "zod";
import {
  getAccountAddress,
  getSmartAccountFromChainData,
} from "../features/wallet/index.js";
import {
  Chain,
  PublicClient,
  createPublicClient,
  defineChain,
  http,
  parseUnits,
} from "viem";
import { IS_TESTNET } from "./settings.js";

const squidBaseUrl = IS_TESTNET
  ? "https://testnet.api.squidrouter.com"
  : "https://api.squidrouter.com";

export const squid = new Squid({
  baseUrl: squidBaseUrl,
});

export let FUSE: Fuse<ChainData> | undefined;
export const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export function getAllChains() {
  return squid.chains.filter((v) => v.chainType === "evm" && v.chainId !== 5);
}

export function getTokensOfChain(network: ChainData) {
  return squid.tokens.filter((v) => v.chainId === network.chainId);
}

function createFUSE() {
  return new Fuse(getAllChains(), {
    ignoreLocation: true,
    keys: ["networkName"],
  });
}

export async function initSquid() {
  await squid.init();
  FUSE = createFUSE();
}

export function getNetworkInformation(networkName: string) {
  const fuse = FUSE || createFUSE();
  // Find minimum value by reducing array
  return fuse.search(networkName)[0].item;
}

export const address = z.custom<`0x${string}`>((val) => {
  return typeof val === "string" ? /^0x[a-fA-F0-9]+$/.test(val) : false;
});
export async function getTokenInformation(
  chainId: string | number,
  tokenSearch: string,
) {
  const isAddress = await address.safeParseAsync(tokenSearch);
  if (isAddress.success) {
    return squid.tokens.find(
      (v) => v.chainId === chainId && v.address === isAddress.data,
    );
  }

  const response = await fetch(
    `https://api.coingecko.com/api/v3/search?query=${tokenSearch}`,
  );
  if (!response.ok) return undefined;
  const coinsResponse: { coins: { id: string }[] } = await response.json();
  if (coinsResponse.coins.length === 0) return undefined;
  return squid.tokens.find(
    (v) => v.chainId === chainId && v.coingeckoId === coinsResponse.coins[0].id,
  );
}

export const RouteType = z.union([z.literal("buy"), z.literal("swap")]);
type RouteType = z.infer<typeof RouteType>;

export async function getRoute(
  type: RouteType,
  amount: string,
  fromNetwork: ChainData,
  fromToken: TokenData,
  toNetwork: ChainData,
  toToken: TokenData,
  slippage: number,
  identifier: string,
): Promise<RouteData> {
  const account = await getSmartAccountFromChainData(identifier, fromNetwork);
  const receiverAccount = await getSmartAccountFromChainData(
    identifier,
    toNetwork,
  );
  if (type === "swap") {
    const fromAmount = parseUnits(amount, fromToken.decimals).toString();
    const { route } = await squid.getRoute({
      fromAmount,
      fromChain: fromNetwork.chainId,
      fromToken: fromToken.address,
      fromAddress: await getAccountAddress(account),
      toChain: toNetwork.chainId,
      toToken: toToken.address,
      toAddress: await getAccountAddress(receiverAccount),
      slippage: slippage,
    });
    return route;
  }

  const fromAmount = parseUnits(amount, toToken.decimals).toString();
  const { route: estimatedRoute } = await squid.getRoute({
    fromAmount,
    fromChain: toNetwork.chainId,
    fromToken: toToken.address,
    fromAddress: await getAccountAddress(receiverAccount),
    toChain: fromNetwork.chainId,
    toToken: fromToken.address,
    toAddress: await getAccountAddress(account),
    slippage: slippage,
  });
  const { route } = await squid.getRoute({
    fromAmount: estimatedRoute.estimate.toAmount,
    fromChain: fromNetwork.chainId,
    fromToken: fromToken.address,
    fromAddress: await getAccountAddress(account),
    toChain: toNetwork.chainId,
    toToken: toToken.address,
    toAddress: await getAccountAddress(receiverAccount),
    slippage: slippage,
  });
  return route;
}

export function getViemChain(network: ChainData): Chain {
  return defineChain({
    id: network.chainId as number,
    name: network.networkName,
    network: network.networkName,
    nativeCurrency: {
      decimals: network.nativeCurrency.decimals,
      name: network.nativeCurrency.name,
      symbol: network.nativeCurrency.symbol,
    },
    rpcUrls: {
      default: {
        http: [network.rpc],
      },
      public: {
        http: [network.rpc],
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
