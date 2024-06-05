import { encodeFunctionData, erc20Abi } from "viem";
import { NATIVE_TOKEN } from "../../squidDB/common";
import { Transaction } from "../../squidDB";

export function getSendTransaction(
  tokenAddress: `0x${string}`,
  recipientAddress: `0x${string}`,
  amount: bigint,
) {
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
    value: amount.toString(),
  };
}

export default function (
  tokenAddress: `0x${string}`,
  recipientAddress: `0x${string}`,
  amount: bigint,
) {
  return getSendTransaction(
    tokenAddress,
    recipientAddress,
    amount,
  ) as Transaction;
}
