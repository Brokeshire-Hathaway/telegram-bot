import { Squid } from "squidv2";
import { ChainData, RouteRequest } from "@0xsquid/squid-types";
import { ENVIRONMENT } from "../common/settings.js";
import { RouteType } from "./common.js";

const squidBaseUrl = ENVIRONMENT.IS_TESTNET
  ? "https://testnet.v2.api.squidrouter.com"
  : "https://v2.api.squidrouter.com";

export const _v2squid = new Squid({
  baseUrl: squidBaseUrl,
  integratorId: ENVIRONMENT.SQUID_INTEGRATOR_ID,
});

export function _v2getTokensOfChain(network: ChainData) {
  return _v2squid.tokens.filter((v) => v.chainId === network.chainId);
}

interface CorrectedRouteRequest extends Omit<RouteRequest, "slippage"> {
  slippageConfig: {
    autoMode: number;
  };
}
export async function _v2getRoute(
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
    const { route } = await _v2squid.getRoute({
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

  const { route: estimatedRoute } = await _v2squid.getRoute({
    fromAmount: amount,
    fromChain: toNetworkChainId,
    fromToken: toTokenAddress,
    fromAddress,
    toChain: fromNetworkChainId,
    toToken: toTokenAddress,
    toAddress,
  } as CorrectedRouteRequest as unknown as RouteRequest);
  const { route } = await _v2squid.getRoute({
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
