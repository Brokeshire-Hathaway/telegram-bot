import { Squid } from "@0xsquid/sdk";
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
import { ENVIRONMENT } from "./settings.js";
import { addUsdPriceToToken, getCoingeckoToken } from "./coingeckoDB.js";
import {
  ChainData,
  FeeCost,
  GasCost,
  RouteRequest,
  Token,
} from "@0xsquid/squid-types";

const squidBaseUrl = ENVIRONMENT.IS_TESTNET
  ? "https://testnet.v2.api.squidrouter.com"
  : "https://v2.api.squidrouter.com";

export const squid = new Squid({
  baseUrl: squidBaseUrl,
  integratorId: ENVIRONMENT.SQUID_INTEGRATOR_ID,
});

export let FUSE: Fuse<ChainData> | undefined;
export const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const IGNORED_CHAINS = ["5", "314", "3141", "2222"];
export function getAllChains() {
  return squid.chains.filter(
    (v) => v.chainType === "evm" && !IGNORED_CHAINS.includes(v.chainId),
  );
}

export function getChainByChainId(chainId: string | number) {
  return squid.chains.find((v) => v.chainId === chainId.toString());
}

export function getTokensOfChain(network: ChainData) {
  return squid.tokens.filter((v) => v.chainId === network.chainId);
}

export function getTokenByAddresAndChainId(
  chainId: string,
  tokenAddress: string,
) {
  return squid.tokens.find(
    (v) => v.chainId.toString() === chainId && v.address === tokenAddress,
  );
}

export function getTokensDecimals(chainId: string, tokenAddress: string) {
  const token = getTokenByAddresAndChainId(chainId, tokenAddress);
  if (!token) return 0;
  return token.decimals;
}

function createFUSE() {
  const chains = getAllChains();
  if (chains.length === 0) return;
  return new Fuse(chains, {
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
  if (!fuse) return undefined;

  // Find minimum value by reducing array
  const searchNetwork = fuse.search(networkName);
  if (searchNetwork.length === 0) return undefined;
  return searchNetwork[0].item;
}

export const address = z.custom<`0x${string}`>((val) => {
  return typeof val === "string" ? /^0x[a-fA-F0-9]+$/.test(val) : false;
});
export type TokenInformation = Token & { usdPrice: number };
export async function getTokenInformation(
  chainId: string | number,
  tokenSearch: string,
): Promise<TokenInformation | undefined> {
  const isAddress = await address.safeParseAsync(tokenSearch);
  if (isAddress.success) {
    const token = squid.tokens.find(
      (v) => v.chainId === chainId && v.address === isAddress.data,
    );
    if (!token || !token.coingeckoId) return undefined;
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

interface CorrectedRouteRequest extends Omit<RouteRequest, "slippage"> {
  slippageConfig: {
    autoMode: number;
  };
}
export async function getRouteWithEmberAccount(
  type: RouteType,
  amount: string,
  fromNetwork: ChainData,
  fromToken: Token,
  toNetwork: ChainData,
  toToken: Token,
  slippage: number,
  identifier: string,
) {
  const account = await getSmartAccountFromChainData(identifier, fromNetwork);
  const receiverAccount = await getSmartAccountFromChainData(
    identifier,
    toNetwork,
  );
  const fromAmount = parseUnits(
    amount,
    type === "swap" ? fromToken.decimals : toToken.decimals,
  ).toString();
  return await getRoute(
    type,
    fromAmount,
    fromNetwork.chainId,
    fromToken.address,
    toNetwork.chainId,
    toToken.address,
    slippage,
    await account.getAccountAddress(),
    await receiverAccount.getAccountAddress(),
  );
}

export async function getRoute(
  type: RouteType,
  amount: string,
  fromNetworkChainId: string,
  fromTokenAddress: string,
  toNetworkChainId: string,
  toTokenAddress: string,
  slippage: number,
  fromAddress: string,
  toAddress: string,
) {
  const squidBaseConfig = {
    slippageConfig: { autoMode: slippage },
    enableBoost: true,
  } as Partial<CorrectedRouteRequest>;
  if (type === "swap") {
    const { route } = await squid.getRoute({
      fromAmount: amount,
      fromChain: fromNetworkChainId,
      fromToken: fromTokenAddress,
      fromAddress,
      toChain: toNetworkChainId,
      toToken: toTokenAddress,
      toAddress,
      ...squidBaseConfig,
    } as CorrectedRouteRequest as unknown as RouteRequest);
    return route;
  }

  const { route: estimatedRoute } = await squid.getRoute({
    fromAmount: amount,
    fromChain: toNetworkChainId,
    fromToken: toTokenAddress,
    fromAddress,
    toChain: fromNetworkChainId,
    toToken: toTokenAddress,
    toAddress,
  } as CorrectedRouteRequest as unknown as RouteRequest);
  const { route } = await squid.getRoute({
    fromAmount: estimatedRoute.estimate.toAmount,
    fromChain: fromNetworkChainId,
    fromToken: fromTokenAddress,
    fromAddress,
    toChain: toNetworkChainId,
    toToken: toTokenAddress,
    toAddress,
    ...squidBaseConfig,
  } as CorrectedRouteRequest as unknown as RouteRequest);
  return route;
}

const ARBITRUM_CHAIN_ID = "42161";
export const MULTICALL_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
export function getViemChain(network: ChainData): Chain {
  const rpc =
    !ENVIRONMENT.ARBITRUM_RPC_URL || network.chainId !== ARBITRUM_CHAIN_ID
      ? network.rpc
      : ENVIRONMENT.ARBITRUM_RPC_URL;
  if (network.chainType !== "evm")
    throw Error("Only EVM chains are supported currently");

  return defineChain({
    id: parseInt(network.chainId),
    name: network.networkName,
    network: network.networkName,
    nativeCurrency: {
      decimals: network.nativeCurrency.decimals,
      name: network.nativeCurrency.name,
      symbol: network.nativeCurrency.symbol,
    },
    contracts: {
      multicall3: {
        address: MULTICALL_ADDRESS,
      },
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
    if (!token.coingeckoId) throw Error("Coingecko id is not set for token");
    const tokenInfo = await addUsdPriceToToken(token, {
      id: token.coingeckoId,
    });
    if (!tokenInfo) continue;
    tokens.push(tokenInfo);
  }
  return [tokens, costs];
}
