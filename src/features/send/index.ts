import express, { Request, Response } from "express";
import z from "zod";
import { ChainId, UserOperation } from "@biconomy/core-types";
import { ChainData, TokenData } from "@0xsquid/sdk";
import {
  getNetworkInformation,
  getTokenInformation,
  address,
  NATIVE_TOKEN,
} from "../../common/squidDB.js";
import { getGasFee, getSmartContract } from "./smartContract.js";
import { getSmartAccount } from "../../account/index.js";
import { randomUUID } from "crypto";
import { formatAmount, formatTokenUrl } from "../../common/formatters.js";

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
    token: TokenData;
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
  const token = await getTokenInformation(network.chainId, body.token);
  if (!token)
    return res
      .status(500)
      .json({ success: false, message: "Token not supported" });

  const contract = getSmartContract(
    token.address,
    body.recipient_address,
    body.amount,
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
    return {
      recipient: body.recipient_address,
      amount: formatAmount(body.amount, token),
      token_symbol: token.symbol,
      token_url: formatTokenUrl(token, network),
      gas_fee: formatAmount(gasFee.toString(), token),
      total_amount: formatAmount(
        (gasFee + BigInt(body.amount)).toString(),
        token,
      ),
      transaction_uuid: uuid,
    };
  } catch (error) {
    res.status(500).json({ success: false, message: `Error: ${error}` });
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
      body.transaction_uuid,
      memory.network.chainId as ChainId,
      memory.network.rpc,
    );
    const result = await account.sendUserOp(memory.userOp);
    const txHash = await result.waitForTxHash();
    const receipt = txHash.userOperationReceipt ?? (await result.wait());
    TRANSACTION_MEMORY.delete(body.transaction_uuid);
    return res.json({
      success: true,
      recipient: memory.recipient,
      amount: memory.amount,
      token_symbol: memory.token.symbol,
      gas_fee: formatAmount(receipt.actualGasUsed.toString(), memory.token),
      total_amount: formatAmount(
        (BigInt(memory.amount) + receipt.actualGasUsed.toBigInt()).toString(),
        memory.token,
      ),
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
