import express, { Request, Response } from "express";
import z from "zod";
import { Squid, TransactionRequest } from "@0xsquid/sdk";
import { randomUUID } from "crypto";
import { UniversalAddress } from "../send/index.js";
import { Network, getChainId } from "../../chain.js";
import { getSmartAccount, getAccountAddress } from "../../account/index.js";
import callSmartContract from "./callSmartContract.js";
import { formatAmount, formatTime, totalFeeCosts } from "./formatters.js";
import { Token, getTokenDecimals, tokenToAddress } from "../../token.js";
import { parseUnits } from "viem";

// Squid object
const squid = new Squid({
  baseUrl: "https://testnet.api.squidrouter.com",
});
export async function initSquid() {
  await squid.init();
}

// Create the router
const router = express.Router();
const TRANSACTION_MEMORY = new Map<
  string,
  {
    route: TransactionRequest;
    identifier: string;
    network: Network;
    fromAmount: string;
    fromToken: string;
  }
>();

// Preview the transaction
const ChainSource = z.object({
  network: Network,
  token: Token,
});
const SwapPreview = z.object({
  amount: z.string(),
  token: Token,
  sender: UniversalAddress,
  to: ChainSource,
  slippage: z.number().optional().default(1.0),
});
router.post("/preview", async (req: Request, res: Response) => {
  const result = await SwapPreview.safeParseAsync(req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }
  const body = result.data;

  // Transform data to pass to squid router
  const account = await getSmartAccount(
    body.sender.identifier,
    body.sender.network,
  );
  const receiverAccount = await getSmartAccount(
    body.sender.identifier,
    body.to.network,
  );

  const fromToken = tokenToAddress(body.token, body.sender.network);
  if (!fromToken)
    return res
      .status(500)
      .json({ success: false, message: "Token not supported" });
  const toToken = tokenToAddress(body.to.token, body.to.network);
  if (!toToken)
    return res
      .status(500)
      .json({ success: false, message: "Token not supported" });

  const fromAmount = parseUnits(
    body.amount,
    await getTokenDecimals(fromToken, body.sender.network),
  ).toString();

  // Get route and store in memory
  try {
    const { route } = await squid.getRoute({
      fromAmount,
      fromChain: getChainId(body.sender.network),
      fromToken,
      fromAddress: await getAccountAddress(account),
      toChain: getChainId(body.to.network),
      toToken: toToken,
      toAddress: await getAccountAddress(receiverAccount),
      slippage: body.slippage,
    });
    if (!route.transactionRequest) {
      return res
        .status(500)
        .json({ success: false, message: "No contract to execute" });
    }
    const uuid = randomUUID();
    TRANSACTION_MEMORY.set(uuid, {
      route: route.transactionRequest,
      identifier: body.sender.identifier,
      network: body.sender.network,
      fromAmount,
      fromToken,
    });
    return res.json({
      success: true,
      uuid,
      from_amount: formatAmount(fromAmount, route.params.fromToken),
      to_amount: formatAmount(route.estimate.toAmount, route.params.toToken),
      duration: formatTime(route.estimate.estimatedRouteDuration),
      total_costs: totalFeeCosts(
        route.estimate.feeCosts,
        route.estimate.gasCosts,
      ),
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to found route" });
  }
});

// Execute swap
const Swap = z.object({
  transaction_uuid: z.string(),
});
const AXELAR_TESTNET_EXPLORER = "https://testnet.axelarscan.io";
router.post("/", async (req: Request, res: Response) => {
  const result = await Swap.safeParseAsync(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, message: result.error });
  }
  const body = result.data;
  const memory = TRANSACTION_MEMORY.get(body.transaction_uuid);
  if (!memory) {
    return res
      .status(500)
      .json({ success: false, message: "Transaction does not exist" });
  }
  try {
    const smartAccount = await getSmartAccount(
      memory.identifier,
      memory.network,
    );
    const transactionHash = await callSmartContract(
      smartAccount,
      memory.route,
      memory.fromToken,
      memory.network,
      memory.fromAmount,
    );
    TRANSACTION_MEMORY.delete(body.transaction_uuid);
    return res.json({
      block: `${AXELAR_TESTNET_EXPLORER}/gmp/${transactionHash}`,
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Failed executing transaction" });
  }
});

export default router;
