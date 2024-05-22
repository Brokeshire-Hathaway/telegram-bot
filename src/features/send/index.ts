import express, { Request, Response } from "express";
import z from "zod";
import {
  getNetworkInformation,
  getTokenInformation,
  address,
  NATIVE_TOKEN,
} from "../../common/squidDB.js";
import {
  getCosts,
  getGasFee,
  getSendTransaction,
  getTokenInfoOfAddress,
  SendToken,
} from "./smartContract.js";
import { getSmartAccountFromChainData } from "../wallet/index.js";
import { costsToUsd } from "../../common/formatters.js";
import { parseUnits } from "viem";
import { createTransaction } from "../frontendApi/common.js";

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
    token.address,
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
        type: "send",
        total: costsToUsd(...tokenCosts),
        fees: gasFee,
      },
      [
        {
          amount,
          token: token.symbol,
          token_address: token.address as `0x${string}`,
          chain: network.networkName,
          chain_id: network.chainId.toString(),
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
      uuid,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: `Error creating user transaction` });
  }
});

export default router;
