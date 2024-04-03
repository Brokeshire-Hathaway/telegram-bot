import { TransactionRequest } from "@0xsquid/sdk";
import { BiconomySmartAccountV2 } from "@biconomy/account";
import { Transaction } from "@biconomy/core-types";
import { erc20Abi } from "abitype/abis";
import { getAccountAddress } from "../../account/index.js";
import {
  createPublicClient,
  encodeFunctionData,
  getContract,
  http,
} from "viem";
import { Network, getViemChain } from "../../chain.js";
import { isTokeNative } from "../../token.js";

async function preSwapContracts(
  fromToken: string,
  network: Network,
  smartAccount: BiconomySmartAccountV2,
  route: TransactionRequest,
  fromAmount: string,
): Promise<Transaction[]> {
  if (isTokeNative(fromToken)) return [];

  // Check current allowance
  const accountAddress = await getAccountAddress(smartAccount);
  const publicClient = createPublicClient({
    chain: getViemChain(network),
    transport: http(),
  });
  const contract = getContract({
    address: fromToken as `0x${string}`,
    abi: erc20Abi,
    publicClient: publicClient,
  });
  const allowance = await contract.read.allowance([
    accountAddress,
    route.targetAddress as `0x${string}`,
  ]);
  const sourceAmount = BigInt(fromAmount);
  if (sourceAmount <= allowance) {
    return [];
  }

  // If allowance is not enough, ask for max allowance
  const dataApprove = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [route.targetAddress as `0x${string}`, BigInt(fromAmount)],
  });
  return [
    {
      to: fromToken,
      data: dataApprove,
    },
  ];
}

function buildTransaction(route: TransactionRequest): Transaction {
  let transaction: Transaction = {
    to: route.targetAddress,
    data: route.data,
  };
  if (route.routeType !== "SEND") {
    transaction = {
      ...transaction,
      value: route.value,
    };
  }
  return transaction;
}

export default async function (
  smartAccount: BiconomySmartAccountV2,
  route: TransactionRequest,
  fromToken: string,
  network: Network,
  fromAmount: string,
) {
  const otherTransactions = await preSwapContracts(
    fromToken,
    network,
    smartAccount,
    route,
    fromAmount,
  );
  const userOp = await smartAccount.buildUserOp(
    otherTransactions.concat([buildTransaction(route)]),
    {
      skipBundlerGasEstimation: true,
      overrides: {
        maxFeePerGas: route.maxFeePerGas,
        maxPriorityFeePerGas: route.maxPriorityFeePerGas,
        callGasLimit: route.gasLimit,
      },
    },
  );
  const responseUserOp = await smartAccount.sendUserOp(userOp);
  const transactionHash = await responseUserOp.waitForTxHash();
  return transactionHash.transactionHash;
}
