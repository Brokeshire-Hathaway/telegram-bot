import express, { Request, Response, Send } from "express";
import z from "zod";
import { ChainData } from "@0xsquid/sdk";
import {
  getNetworkInformation,
  getTokenInformation,
  address,
  NATIVE_TOKEN,
} from "../../common/squidDB.js";
import {
  getCosts,
  getGasFee,
  getSmartContract,
  getTokenInfoOfAddress,
  SendToken,
} from "./smartContract.js";
import { getSmartAccountFromChainData } from "../wallet/index.js";
import { randomUUID } from "crypto";
import {
  formatTokenValue,
  formatTotalAmount,
} from "../../common/formatters.js";
import { parseUnits } from "viem";
import { UserOperationStruct } from "@biconomy/account";

// Create the router
const router = express.Router();

// In memory transaction storage
const TRANSACTION_MEMORY = new Map<
  string,
  {
    accountUid: string;
    recipient: `0x${string}`;
    userOp: Partial<UserOperationStruct>;
    network: ChainData;
    amount: string;
    token: SendToken;
    nativeToken: SendToken;
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
  const contract = getSmartContract(
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
    const uuid = randomUUID();
    const nativeToken =
      token.address !== NATIVE_TOKEN
        ? await getTokenInformation(network.chainId, NATIVE_TOKEN)
        : token;
    if (!nativeToken)
      return res
        .status(500)
        .json({ success: false, message: "Native token not found" });

    TRANSACTION_MEMORY.set(uuid, {
      accountUid: body.sender_address.identifier,
      recipient: body.recipient_address,
      userOp,
      network,
      token,
      amount: body.amount,
      nativeToken,
    });
    const tokenCosts = getCosts(amount, token, gasFee, nativeToken);

    return res.json({
      recipient: body.recipient_address,
      amount: formatTokenValue(token, amount, network),
      fees: formatTokenValue(nativeToken, gasFee, network),
      total: formatTotalAmount(...tokenCosts, network),
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
    const account = await getSmartAccountFromChainData(
      memory.accountUid,
      memory.network,
    );
    const result = await account.sendUserOp(memory.userOp);
    const txHash = await result.waitForTxHash();
    try {
      !txHash.userOperationReceipt
        ? await result.wait()
        : txHash.userOperationReceipt;
    } catch {
      console.warn("User operation receipt could not be found.");
    }
    TRANSACTION_MEMORY.delete(body.transaction_uuid);
    return res.json({
      success: true,
      recipient: memory.recipient,
      amount: formatTokenValue(
        memory.nativeToken,
        memory.amount,
        memory.network,
      ),
      fees: txHash.userOperationReceipt
        ? formatTokenValue(
            memory.nativeToken,
            txHash.userOperationReceipt.actualGasUsed,
            memory.network,
          )
        : null,
      total: txHash.userOperationReceipt
        ? formatTotalAmount(
            ...getCosts(
              memory.amount,
              memory.token,
              txHash.userOperationReceipt.actualGasUsed,
              memory.nativeToken,
            ),
            memory.network,
          )
        : null,
      transaction_block: `${memory.network.blockExplorerUrls[0]}/tx/${txHash.transactionHash}`,
    });
  } catch (error) {
    console.error(error);
    let msg = "Send failed";
    if (typeof error === "object" && !!error && "message" in error) {
      msg = error.message as string;
    }
    res.status(500).json({ success: false, message: msg });
  }
});

export default router;
