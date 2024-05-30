import { Transaction } from "@biconomy/account";
import { encodeFunctionData, getContract, erc20Abi } from "viem";
import {
  NATIVE_TOKEN,
  getChainByChainId,
  getTokenByAddresAndChainId,
  getViemClient,
  squid,
} from "../../common/squidDB.js";
import { ChainData, SquidData, Token } from "@0xsquid/squid-types";

async function preSwapContracts(
  fromToken: Token,
  network: ChainData,
  accountAddress: `0x${string}`,
  route: SquidData,
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
    route.target as `0x${string}`,
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
      to: fromToken.address,
      data: dataApprove,
    },
  ];
}

function buildTransaction(route: SquidData): Transaction {
  return {
    to: route.target,
    data: route.data,
    value: route.value,
  };
}

export default async function (
  accountAddress: `0x${string}`,
  fromChainId: string,
  fromTokenAddress: string,
  toChainId: string,
  toTokenAddress: string,
  fromAmount: bigint,
) {
  const { route } = await squid.getRoute({
    fromAmount: fromAmount.toString(),
    fromChain: fromChainId,
    toChain: toChainId,
    fromToken: fromTokenAddress,
    toToken: toTokenAddress,
    fromAddress: accountAddress,
    toAddress: accountAddress,
    slippage: 1.0,
  });
  if (!route.transactionRequest)
    throw new Error("Route could not be constructed");
  const request = route.transactionRequest;

  const network = getChainByChainId(fromChainId);
  if (!network) throw new Error("Network could not be found");

  const fromToken = getTokenByAddresAndChainId(fromChainId, fromTokenAddress);
  if (!fromToken) throw new Error("Token could not be found");
  const transactions = (
    await preSwapContracts(
      fromToken,
      network,
      accountAddress,
      route.transactionRequest,
      fromAmount,
    )
  ).concat([buildTransaction(request)]);
  return transactions;
}
