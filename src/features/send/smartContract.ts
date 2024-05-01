import { Transaction, UserOperation } from "@biconomy/core-types";
import { erc20Abi } from "abitype/abis";
import { encodeFunctionData, getContract } from "viem";
import { NATIVE_TOKEN, getViemChain } from "../../common/squidDB.js";
import { BigNumber, BigNumberish } from "ethers";
import { ChainData } from "@0xsquid/sdk";

export async function getTokenInfoOfAddress(
  address: `0x${string}`,
  network: ChainData,
) {
  const publicClient = getViemChain(network);
  const contract = getContract({
    address: address,
    abi: erc20Abi,
    publicClient: publicClient,
  });
  const decimals = await contract.read.decimals();
  const symbol = await contract.read.symbol();
  return {
    decimals,
    symbol,
    address,
  };
}

export function getSmartContract(
  tokenAddress: string,
  recipientAddress: `0x${string}`,
  amount: bigint,
): Transaction {
  if (tokenAddress !== NATIVE_TOKEN) {
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipientAddress, amount],
    });
    return { to: tokenAddress, data };
  }
  return {
    to: recipientAddress,
    data: "0x",
    value: amount,
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
    (bigNumberishToBigInt(userOp.verificationGasLimit) +
      bigNumberishToBigInt(userOp.callGasLimit) +
      bigNumberishToBigInt(userOp.preVerificationGas)) *
    bigNumberishToBigInt(userOp.maxFeePerGas, 1)
  );
}
