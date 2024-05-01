import { Transaction, UserOperation } from "@biconomy/core-types";
import { erc20Abi } from "abitype/abis";
import { encodeFunctionData } from "viem";
import { NATIVE_TOKEN } from "../../common/squidDB.js";
import { BigNumber, BigNumberish } from "ethers";

export function getSmartContract(
  tokenAddress: string,
  recipientAddress: `0x${string}`,
  amount: string,
): Transaction {
  const amountInt = BigInt(amount);
  if (tokenAddress !== NATIVE_TOKEN) {
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipientAddress, amountInt],
    });
    return { to: tokenAddress, data };
  }
  return {
    to: recipientAddress,
    data: "0x",
    value: amountInt,
  };
}

function bigNumberishToBigInt(
  number: BigNumberish | undefined,
  fallback: number = 0,
): bigint {
  return number ? BigNumber.from(number).toBigInt() : BigInt(fallback);
}

export function getGasFee(userOp: Partial<UserOperation>) {
  return (
    (bigNumberishToBigInt(userOp.maxFeePerGas) +
      bigNumberishToBigInt(userOp.verificationGasLimit) +
      bigNumberishToBigInt(userOp.callGasLimit) +
      bigNumberishToBigInt(userOp.preVerificationGas)) *
    bigNumberishToBigInt(userOp.maxFeePerGas, 1)
  );
}
