import {
  UserOperationStruct,
  type Transaction,
  BigNumberish,
} from "@biconomy/account";
import { erc20Abi } from "abitype/abis";
import { encodeFunctionData, getContract } from "viem";
import { NATIVE_TOKEN, getViemClient } from "../../common/squidDB.js";
import { ChainData } from "@0xsquid/sdk";

export async function getTokenInfoOfAddress(
  address: `0x${string}`,
  network: ChainData,
) {
  const publicClient = getViemClient(network);
  const contract = getContract({
    address: address,
    abi: erc20Abi,
    client: publicClient,
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
  return number ? BigInt(number) : BigInt(fallback);
}

export function getGasFee(userOp: Partial<UserOperationStruct>) {
  return (
    (bigNumberishToBigInt(userOp.verificationGasLimit) +
      bigNumberishToBigInt(userOp.callGasLimit) +
      bigNumberishToBigInt(userOp.preVerificationGas)) *
    bigNumberishToBigInt(userOp.maxFeePerGas, 1)
  );
}
