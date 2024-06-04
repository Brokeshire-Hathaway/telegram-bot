import { RouteData, Squid } from "squidv1";
import { ENVIRONMENT } from "../common/settings.js";
import { RouteType } from "./common.js";

const squidBaseUrl = ENVIRONMENT.IS_TESTNET
  ? "https://testnet.api.squidrouter.com"
  : "https://api.squidrouter.com";

export const _v1squid = new Squid({
  baseUrl: squidBaseUrl,
});

export async function _v1getRoute(
  type: RouteType,
  amount: string,
  fromNetworkChainId: string | number,
  fromTokenAddress: string,
  toNetworkChainId: string | number,
  toTokenAddress: string,
  slippage: number,
  fromAddress: string,
  toAddress: string,
): Promise<RouteData> {
  if (type === "swap") {
    const { route } = await _v1squid.getRoute({
      fromAmount: amount,
      fromChain: fromNetworkChainId,
      fromToken: fromTokenAddress,
      fromAddress: fromAddress,
      toChain: toNetworkChainId,
      toToken: toTokenAddress,
      toAddress: toAddress,
      slippage: slippage,
    });
    return route;
  }
  const { route: estimatedRoute } = await _v1squid.getRoute({
    fromAmount: amount,
    toChain: fromNetworkChainId,
    toToken: fromTokenAddress,
    fromAddress: fromAddress,
    fromChain: toNetworkChainId,
    fromToken: toTokenAddress,
    toAddress: toAddress,
    slippage: slippage,
  });
  const { route } = await _v1squid.getRoute({
    fromAmount: estimatedRoute.estimate.toAmount,
    fromChain: fromNetworkChainId,
    fromToken: fromTokenAddress,
    fromAddress: fromAddress,
    toChain: toNetworkChainId,
    toToken: toTokenAddress,
    toAddress: toAddress,
    slippage: slippage,
  });
  return route;
}
