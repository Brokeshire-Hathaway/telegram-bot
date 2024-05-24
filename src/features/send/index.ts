import express, { Request, Response } from "express";
import z from "zod";
import {
  getNetworkInformation,
  getTokenInformation,
  address,
  NATIVE_TOKEN,
  getViemClient,
  TokenInformation,
} from "../../common/squidDB.js";
import { getSendTransaction } from "./getTransactions.js";
import { getSmartAccountFromChainData } from "../wallet/index.js";
import { costsToUsd } from "../../common/formatters.js";
import { erc20Abi, getContract, parseUnits } from "viem";
import { createTransaction } from "../frontendApi/common.js";
import { BigNumberish, UserOperationStruct } from "@biconomy/account";
import { ChainData } from "@0xsquid/sdk";
import { findUsdPrice } from "../../common/coingeckoDB.js";
import { ENVIRONMENT } from "../../common/settings.js";

// Create the router
const router = express.Router();

// Endpoint to prepare a transaction
export const UniversalAddress = z.object({
  network: z.string(),
  identifier: z.string(),
  platform: z.string(),
});
const PrepareTransactionBody = z.object({
  sender_address: UniversalAddress,
  recipient_address: address,
  amount: z.string(),
  token: z.string(),
});
router.post("/prepare", async (req: Request, res: Response) => {
  const result = await PrepareTransactionBody.safeParseAsync(req.body);
  if (!result.success) {
    console.log(result.error);
    return res
      .status(400)
      .json({ success: false, message: "Invalid request body" });
  }
  const body = result.data;
  const network = getNetworkInformation(body.sender_address.network);
  if (!network)
    return res
      .status(500)
      .json({ success: false, message: "Network not supported" });
  if (body.token === "0x") body.token = NATIVE_TOKEN;
  let token: SendToken | undefined = await getTokenInformation(
    network.chainId,
    body.token,
  );
  if (!token) {
    const isAddress = await address.safeParseAsync(body.token);
    if (!isAddress.success)
      return res
        .status(500)
        .json({ success: false, message: "Token not supported" });
    token = await getTokenInfoOfAddress(isAddress.data, network);
  }
  if (!token)
    return res
      .status(500)
      .json({ success: false, message: "Token not supported" });

  const amount = parseUnits(body.amount, token.decimals);
  const contract = getSendTransaction(
    token.address as `0x${string}`,
    body.recipient_address,
    amount,
  );
  try {
    const account = await getSmartAccountFromChainData(
      body.sender_address.identifier,
      network,
    );
    const userOp = await account.buildUserOp([contract]);
    const gasFee = getGasFee(userOp);
    const nativeToken =
      token.address !== NATIVE_TOKEN
        ? await getTokenInformation(network.chainId, NATIVE_TOKEN)
        : token;
    if (!nativeToken)
      return res
        .status(500)
        .json({ success: false, message: "Native token not found" });

    const tokenCosts = getCosts(amount, token, gasFee, nativeToken);
    const uuid = await createTransaction(
      {
        total: costsToUsd(...tokenCosts),
        fees: gasFee,
        call_gas_limit: userOp.callGasLimit
          ? BigInt(userOp.callGasLimit)
          : undefined,
        max_fee_per_gas: userOp.maxFeePerGas
          ? BigInt(userOp.maxFeePerGas)
          : undefined,
        max_priority_fee_per_gas: userOp.maxPriorityFeePerGas
          ? BigInt(userOp.maxPriorityFeePerGas)
          : undefined,
      },
      [
        {
          amount,
          token: token.symbol,
          token_address: token.address as `0x${string}`,
          chain: network.networkName,
          chain_id: network.chainId.toString(),
          type: "send",
          address: "OWNER",
        },
        {
          amount,
          token: token.symbol,
          token_address: token.address as `0x${string}`,
          chain: network.networkName,
          chain_id: network.chainId.toString(),
          address: body.recipient_address,
        },
      ],
    );

    return res.json({
      success: true,
      url: `${ENVIRONMENT.FRONTEND_URL}/${uuid}`,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: `Error creating user transaction` });
  }
});

function bigNumberishToBigInt(
  number: BigNumberish | undefined,
  fallback: number = 0,
): bigint {
  return number ? BigInt(number) : BigInt(fallback);
}

function getGasFee(userOp: Partial<UserOperationStruct>) {
  return (
    (bigNumberishToBigInt(userOp.verificationGasLimit) +
      bigNumberishToBigInt(userOp.callGasLimit) +
      bigNumberishToBigInt(userOp.preVerificationGas)) *
    bigNumberishToBigInt(userOp.maxFeePerGas, 1)
  );
}

async function getTokenInfoOfAddress(
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

export default router;
