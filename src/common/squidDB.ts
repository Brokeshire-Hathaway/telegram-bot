import {
  ChainData,
  FeeCost,
  GasCost,
  RouteData,
  Squid,
  TokenData,
} from "@0xsquid/sdk";
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
import { ARBITRUM_RPC_URL, IS_TESTNET } from "./settings.js";
import { addUsdPriceToToken, getCoingeckoToken } from "./coingeckoDB.js";

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

const ARBITRUM_CHAIN_ID = 42161;
export async function initSquid() {
  await squid.init();
  FUSE = createFUSE();
  if (!ARBITRUM_RPC_URL) return;

  // Patch a
  for (let i = 0; i < squid.chains.length; i++) {
    if (squid.chains[i].chainId === ARBITRUM_CHAIN_ID)
      squid.chains[i].rpc = ARBITRUM_RPC_URL;
  }
}

export function getNetworkInformation(networkName: string) {
  const fuse = FUSE || createFUSE();
  // Find minimum value by reducing array
  return fuse.search(networkName)[0].item;
}

export const address = z.custom<`0x${string}`>((val) => {
  return typeof val === "string" ? /^0x[a-fA-F0-9]+$/.test(val) : false;
});
export type TokenInformation = TokenData & { usdPrice: number };
export async function getTokenInformation(
  chainId: string | number,
  tokenSearch: string,
): Promise<TokenInformation | undefined> {
  const isAddress = await address.safeParseAsync(tokenSearch);
  if (isAddress.success) {
    const token = squid.tokens.find(
      (v) => v.chainId === chainId && v.address === isAddress.data,
    );
    if (!token) return undefined;
    return addUsdPriceToToken(token, { id: token.coingeckoId });
  }

  const coingeckoToken = await getCoingeckoToken(tokenSearch);
  if (!coingeckoToken) return undefined;
  const token = squid.tokens.find(
    (v) => v.chainId === chainId && v.coingeckoId === coingeckoToken.id,
  );
  if (!token) return undefined;
  return addUsdPriceToToken(token, coingeckoToken);
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

function addCost(
  costs: Map<string, bigint>,
  txCosts: { token: { symbol: string; decimals: number }; amount: string }[],
) {
  for (const cost of txCosts) {
    const previewCost = costs.get(cost.token.symbol) || BigInt(0);
    costs.set(cost.token.symbol, previewCost + BigInt(cost.amount));
  }
}

export async function routeFeesToTokenMap(
  feeCosts: FeeCost[],
  gasCosts: GasCost[],
): Promise<[TokenInformation[], Map<string, bigint>]> {
  const tokenMap = new Map(feeCosts.map((v) => [v.token.symbol, v.token]));
  for (const gasCost of gasCosts) {
    tokenMap.set(gasCost.token.symbol, gasCost.token);
  }
  const costs = new Map<string, bigint>();
  addCost(costs, feeCosts);
  addCost(costs, gasCosts);
  const tokens = [] as TokenInformation[];
  for (const token of tokenMap.values()) {
    const tokenInfo = await addUsdPriceToToken(token, {
      id: token.coingeckoId,
    });
    if (!tokenInfo) continue;
    tokens.push(tokenInfo);
  }
  return [tokens, costs];
}
