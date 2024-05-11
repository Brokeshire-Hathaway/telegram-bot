import {
  UserOperationStruct,
  type Transaction,
  BigNumberish,
} from "@biconomy/account";
import { encodeFunctionData, getContract, erc20Abi } from "viem";
import {
  NATIVE_TOKEN,
  TokenInformation,
  getViemClient,
} from "../../common/squidDB.js";
import { ChainData } from "@0xsquid/sdk";
import { findUsdPrice } from "../../common/coingeckoDB.js";

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
  const name = await contract.read.name();
  return await findUsdPrice(
    {
      decimals,
      symbol,
      address,
      name,
    },
    "name",
  );
}

export type SendToken = Pick<
  TokenInformation,
  "address" | "usdPrice" | "decimals" | "symbol"
>;
export function getCosts(
  amount: bigint | string,
  token: SendToken,
  gas: bigint | string,
  nativeToken: SendToken,
): [SendToken[], Map<string, bigint>] {
  const costs = new Map<string, bigint>();
  const value = BigInt(amount);
  const gasValue = BigInt(gas);
  const tokens = [nativeToken];
  if (token.address === NATIVE_TOKEN) {
    costs.set(token.symbol, value + gasValue);
    return [tokens, costs];
  }
  costs.set(token.symbol, value);
  costs.set(nativeToken.symbol, gasValue);
  tokens.push(token);
  return [tokens, costs];
}

export function getSendTransaction(
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
