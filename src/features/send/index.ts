import express, { Request, Response } from "express";
import z from "zod";
import { ChainId, UserOperation } from "@biconomy/core-types";
import { ChainData } from "@0xsquid/sdk";
import {
  getNetworkInformation,
  getTokenInformation,
  address,
  NATIVE_TOKEN,
} from "../../common/squidDB.js";
import {
  getGasFee,
  getSmartContract,
  getTokenInfoOfAddress,
} from "./smartContract.js";
import { getSmartAccount } from "../wallet/index.js";
import { randomUUID } from "crypto";
import { formatAmount, formatTokenUrl } from "../../common/formatters.js";
import { parseUnits } from "viem";

// Create the router
const router = express.Router();

// In memory transaction storage
const TRANSACTION_MEMORY = new Map<
  string,
  {
    accountUid: string;
    recipient: `0x${string}`;
    userOp: Partial<UserOperation>;
    network: ChainData;
    amount: string;
    token: {
      address: string;
      decimals: number;
      symbol: string;
    };
  }
>();

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
  let token: { decimals: number; symbol: string; address: string } | undefined =
    await getTokenInformation(network.chainId, body.token);
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
  const contract = getSmartContract(
    token.address,
    body.recipient_address,
    amount,
  );
  try {
    const account = await getSmartAccount(
      body.sender_address.identifier,
      network.chainId as ChainId,
      network.rpc,
    );
    const userOp = await account.buildUserOp([contract]);
    const gasFee = getGasFee(userOp);
    const uuid = randomUUID();
    TRANSACTION_MEMORY.set(uuid, {
      accountUid: body.sender_address.identifier,
      recipient: body.recipient_address,
      userOp,
      network,
      token,
      amount: body.amount,
    });
    return res.json({
      recipient: body.recipient_address,
      amount: body.amount,
      token_symbol: token.symbol,
      token_url: formatTokenUrl(token, network),
      gas_fee: formatAmount(gasFee.toString(), token),
      total_amount: formatAmount((gasFee + amount).toString(), token),
      transaction_uuid: uuid,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: `Error creating user transaction` });
  }
});

// Endpoint to send a prepared transaction
const SendTransactionBody = z.object({
  transaction_uuid: z.string().uuid(),
});
router.post("/send", async (req: Request, res: Response) => {
  const result = await SendTransactionBody.safeParseAsync(req.body);
  if (!result.success) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid request body" });
  }
  const body = result.data;
  const memory = TRANSACTION_MEMORY.get(body.transaction_uuid);
  if (!memory) {
    return res
      .status(500)
      .json({ success: false, message: "Transaction does not exist" });
  }
  try {
    const account = await getSmartAccount(
      memory.accountUid,
      memory.network.chainId as ChainId,
      memory.network.rpc,
    );
    const result = await account.sendUserOp(memory.userOp);
    const txHash = await result.waitForTxHash();
    const amount = parseUnits(memory.amount, memory.token.decimals);
    TRANSACTION_MEMORY.delete(body.transaction_uuid);
    return res.json({
      success: true,
      recipient: memory.recipient,
      amount: memory.amount,
      token_symbol: memory.token.symbol,
      gas_fee: txHash.userOperationReceipt
        ? formatAmount(
            txHash.userOperationReceipt.actualGasUsed.toString(),
            memory.token,
          )
        : null,
      total_amount: txHash.userOperationReceipt
        ? formatAmount(
            (
              amount + txHash.userOperationReceipt.actualGasUsed.toBigInt()
            ).toString(),
            memory.token,
          )
        : null,
      transaction_block: `${memory.network.blockExplorerUrls[0]}/tx/${txHash.transactionHash}`,
    });
  } catch (error) {
    let msg = "Send failed";
    if (typeof error === "object" && !!error && "message" in error) {
      msg = error.message as string;
    }
    res.status(500).json({ success: false, message: msg });
  }
});

export default router;
