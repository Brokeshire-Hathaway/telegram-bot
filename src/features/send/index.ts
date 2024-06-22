import express, { Request, Response } from "express";
import z from "zod";
import { address, NATIVE_TOKEN } from "../../squidDB/common.js";
import {
  getNetworkInformation,
  getTokenInformation,
  getViemClient,
  TokenInformation,
  ChainData,
} from "../../squidDB";
import { costsToUsd } from "../../common/formatters.js";
import { erc20Abi, getContract, parseUnits } from "viem";
import { createTransaction, getTransactionUrl } from "../frontendApi/common.js";
import { findUsdPrice } from "../../common/coingeckoDB.js";

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
  try {
    const nativeToken =
      token.address !== NATIVE_TOKEN
        ? await getTokenInformation(network.chainId, NATIVE_TOKEN)
        : token;
    if (!nativeToken)
      return res
        .status(500)
        .json({ success: false, message: "Native token not found" });

    const tokenCosts = getCosts(amount, token, BigInt(0), nativeToken);
    const uuid = await createTransaction(
      {
        total: costsToUsd(...tokenCosts),
        fees: BigInt(0),
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
      body.sender_address.identifier,
    );

    return res.json({
      success: true,
      id: uuid,
      sign_url: getTransactionUrl(uuid),
      network_name: network.networkName,
      token_symbol: token.symbol,
      token_explorer_url: `${network.blockExplorerUrls[0]}token/${token.address}`,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: `Error creating user transaction` });
  }
});

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
