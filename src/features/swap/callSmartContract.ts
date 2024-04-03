import { TransactionRequest } from "@0xsquid/sdk";
import { BiconomySmartAccountV2 } from "@biconomy/account";
import { Transaction } from "@biconomy/core-types";
import { erc20Abi } from "abitype/abis";
import { ethers } from "ethers";
import { getAccountAddress } from "../../account/index.js";
import {
  createPublicClient,
  encodeFunctionData,
  getContract,
  http,
} from "viem";
import { Network, getViemChain } from "../../chain.js";

const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export const UINT_256_MAX_VALUE =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

async function validateAllowance(
  fromToken: string,
  network: Network,
  smartAccount: BiconomySmartAccountV2,
  route: TransactionRequest,
  fromAmount: string,
) {
  try {
    if (fromToken === NATIVE_TOKEN) return true;

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
    const sourceAmount = ethers.BigNumber.from(fromAmount);
    if (!sourceAmount.gt(allowance)) {
      return true;
    }

    // If allowance is not enough, ask for max allowance
    const amountToApprove = ethers.BigNumber.from(fromAmount);
    const dataApprove = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [route.targetAddress as `0x${string}`, amountToApprove.toBigInt()],
    });
    const userOp = await smartAccount.buildUserOp(
      [
        {
          to: fromToken,
          data: dataApprove,
        },
      ],
      {
        skipBundlerGasEstimation: true,
        overrides: {
          maxFeePerGas: route.maxFeePerGas,
          maxPriorityFeePerGas: route.maxPriorityFeePerGas,
          callGasLimit: route.gasLimit,
        },
      },
    );
    const response = await smartAccount.sendUserOp(userOp);
    await response.wait();
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
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
  if (
    !(await validateAllowance(
      fromToken,
      network,
      smartAccount,
      route,
      fromAmount,
    ))
  ) {
    throw Error("No allowance");
  }
  console.log("allowance passed");

  const userOp = await smartAccount.buildUserOp([buildTransaction(route)], {
    skipBundlerGasEstimation: true,
    overrides: {
      maxFeePerGas: route.maxFeePerGas,
      maxPriorityFeePerGas: route.maxPriorityFeePerGas,
      callGasLimit: route.gasLimit,
    },
  });
  const responseUserOp = await smartAccount.sendUserOp(userOp);
  const transactionHash = await responseUserOp.waitForTxHash();
  return transactionHash.transactionHash;
}
