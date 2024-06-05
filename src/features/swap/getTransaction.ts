import {
  getChainByChainId,
  getRoute,
  getTokenByAddresAndChainId,
  RouteRequest,
  routeRequestToTransaction,
} from "../../squidDB";

export default async function (
  accountAddress: `0x${string}`,
  fromChainId: string,
  fromTokenAddress: string,
  toChainId: string,
  toTokenAddress: string,
  fromAmount: bigint,
) {
  const route = await getRoute(
    "swap",
    fromAmount.toString(),
    fromChainId,
    fromTokenAddress,
    toChainId,
    toTokenAddress,
    1,
    accountAddress,
    accountAddress,
  );
  if (!route.transactionRequest)
    throw new Error("Route could not be constructed");

  const network = getChainByChainId(fromChainId);
  if (!network) throw new Error("Network could not be found");

  const fromToken = getTokenByAddresAndChainId(fromChainId, fromTokenAddress);
  if (!fromToken) throw new Error("Token could not be found");
  const request = route.transactionRequest as RouteRequest;
  return routeRequestToTransaction(request);
}
