import { SquidData, Token } from "@0xsquid/squid-types";
import * as squid1 from "./v1";
import * as squid2 from "./v2";
import { ENVIRONMENT, Settings } from "../common/settings";
import z from "zod";
import {
  ChainData as ChainDataV1,
  TokenData,
  RouteData as RouteDataV1,
  FeeCost as FeeCostV1,
  GasCost as GasCostV1,
} from "squidv1";
import {
  ChainData as ChainDataV2,
  RouteResponse,
  FeeCost as FeeCostV2,
  GasCost as GasCostV2,
} from "@0xsquid/squid-types";
import {
  Chain,
  Hex,
  PublicClient,
  createPublicClient,
  defineChain,
  http,
  parseUnits,
} from "viem";
import { MULTICALL_ADDRESS, RouteType, address } from "./common";
import { addUsdPriceToToken, getCoingeckoToken } from "../common/coingeckoDB";
import Fuse from "fuse.js";
import { getSmartAccountFromChainData } from "../features/wallet";

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

export function getChainByChainId(
  chainId: string | number,
  version: Version | undefined = undefined,
) {
  return getSquid(version).chains.find(
    (v) => v.chainId.toString() === chainId.toString(),
  );
}

type RouteToken = Pick<TokenInformation, "decimals" | "address">;
export async function getRouteWithEmberAccount(
  type: RouteType,
  amount: string,
  fromNetwork: ChainData,
  fromToken: RouteToken,
  toNetwork: ChainData,
  toToken: RouteToken,
  slippage: number,
  identifier: string,
  version: Version | undefined = undefined,
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
    version,
  );
}

export type RouteData = RouteDataV1 | RouteResponse["route"];
export async function getRoute(
  type: RouteType,
  amount: string,
  fromNetworkChainId: string | number,
  fromTokenAddress: string,
  toNetworkChainId: string | number,
  toTokenAddress: string,
  slippage: number,
  fromAddress: string,
  toAddress: string,
  version: Version | undefined = undefined,
) {
  const squidVersion = getVersion(version);
  if (squidVersion === 2)
    return squid2._v2getRoute(
      type,
      amount,
      fromNetworkChainId.toString(),
      fromTokenAddress,
      toNetworkChainId.toString(),
      toTokenAddress,
      slippage,
      fromAddress,
      toAddress,
    );
  return squid1._v1getRoute(
    type,
    amount,
    fromNetworkChainId,
    fromTokenAddress,
    toNetworkChainId,
    toTokenAddress,
    slippage,
    fromAddress,
    toAddress,
  );
}
type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
type XOR<T, U> = T | U extends object
  ? (Without<T, U> & U) | (Without<U, T> & T)
  : T | U;
export type RouteRequest = XOR<
  NonNullable<RouteDataV1["transactionRequest"]>,
  SquidData
>;

export function getTargetAddress(route: RouteRequest) {
  return (route.targetAddress ? route.targetAddress : route.target) as Hex;
}

export type Transaction = {
  to: `0x${string}`;
  data?: string;
  value?: string;
};
export function routeRequestToTransaction(route: RouteRequest): Transaction {
  return {
    to: getTargetAddress(route),
    data: route.data,
    value: route.value,
  };
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

type FeeCost = FeeCostV1 | FeeCostV2;
type GasCost = GasCostV1 | GasCostV2;
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
