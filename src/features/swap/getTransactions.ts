import { encodeFunctionData, getContract, erc20Abi, Hex } from "viem";
import {
  getChainByChainId,
  getRoute,
  getTokenByAddresAndChainId,
  getViemClient,
  ChainData,
  TokenInformation,
  RouteRequest,
  getTargetAddress,
  routeRequestToTransaction,
  Transaction,
} from "../../squidDB";
import { NATIVE_TOKEN } from "../../squidDB/common";

async function preSwapContracts(
  fromToken: Pick<TokenInformation, "address">,
  network: ChainData,
  accountAddress: `0x${string}`,
  route: RouteRequest,
  fromAmount: bigint,
): Promise<Transaction[]> {
  if (fromToken.address === NATIVE_TOKEN) return [];

  // Check current allowance
  const publicClient = getViemClient(network);
  const contract = getContract({
    address: fromToken.address as `0x${string}`,
    abi: erc20Abi,
    client: publicClient,
  });
  const allowance = await contract.read.allowance([
    accountAddress,
    getTargetAddress(route),
  ]);
  if (fromAmount <= allowance) {
    return [];
  }

  // If allowance is not enough, ask for max allowance
  const dataApprove = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [route.target as `0x${string}`, fromAmount],
  });
  return [
    {
      to: fromToken.address as Hex,
      data: dataApprove,
    },
  ];
}

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
  const transactions = (
    await preSwapContracts(
      fromToken,
      network,
      accountAddress,
      request,
      fromAmount,
    )
  ).concat([routeRequestToTransaction(request)]);
  return transactions;
}
