import express, { Request, Response } from "express";
import z from "zod";
import { ChainData, TokenData, TransactionRequest } from "@0xsquid/sdk";
import { randomUUID } from "crypto";
import { UniversalAddress } from "../send/index.js";
import { getSmartAccountFromChainData } from "../wallet/index.js";
import callSmartContract from "./callSmartContract.js";
import {
  formatFees,
  formatTime,
  formatTokenValue,
  formatTotalAmount,
} from "../../common/formatters.js";
import {
  RouteType,
  getNetworkInformation,
  getRoute,
  getTokenInformation,
  routeFeesToTokenMap,
} from "../../common/squidDB.js";
import { ENVIRONMENT } from "../../common/settings.js";

// Create the router
const router = express.Router();
const TRANSACTION_MEMORY = new Map<
  string,
  {
    route: TransactionRequest;
    identifier: string;
    network: ChainData;
    fromAmount: string;
    fromToken: TokenData;
  }
>();

// Preview the transaction
const ChainSource = z.object({
  network: z.string(),
  token: z.string(),
});
const SwapPreview = z.object({
  type: RouteType.optional().default("swap"),
  amount: z.string(),
  token: z.string(),
  sender: UniversalAddress,
  to: ChainSource,
  slippage: z.number().optional().default(1.0),
});
router.post("/preview", async (req: Request, res: Response) => {
  const result = await SwapPreview.safeParseAsync(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid request body",
      error: result.error,
    });
  }
  const body = result.data;

  // Transform data to pass to squid router
  const fromNetwork = getNetworkInformation(body.sender.network);
  const toNetwork = getNetworkInformation(body.to.network);
  const fromToken = await getTokenInformation(fromNetwork.chainId, body.token);
  if (!fromToken)
    return res
      .status(500)
      .json({ success: false, message: "Token not supported" });
  const toToken = await getTokenInformation(toNetwork.chainId, body.to.token);
  if (!toToken)
    return res
      .status(500)
      .json({ success: false, message: "Token not supported" });

  // Get route and store in memory
  try {
    const route = await getRoute(
      body.type,
      body.amount,
      fromNetwork,
      fromToken,
      toNetwork,
      toToken,
      body.slippage,
      body.sender.identifier,
    );
    if (!route.transactionRequest) {
      return res
        .status(500)
        .json({ success: false, message: "No contract to execute" });
    }
    const uuid = randomUUID();
    TRANSACTION_MEMORY.set(uuid, {
      route: route.transactionRequest,
      identifier: body.sender.identifier,
      network: fromNetwork,
      fromAmount: route.estimate.fromAmount,
      fromToken,
    });
    const feeCosts = await routeFeesToTokenMap(
      route.estimate.feeCosts,
      route.estimate.gasCosts,
    );
    const totalFees = formatFees(...feeCosts, fromNetwork);
    const feeOfFromAmount = feeCosts[1].get(fromToken.symbol);
    if (!feeOfFromAmount) {
      feeCosts[1].set(fromToken.symbol, BigInt(route.params.fromAmount));
      feeCosts[0].push(fromToken);
    } else {
      feeCosts[1].set(
        fromToken.symbol,
        feeOfFromAmount + BigInt(route.params.fromAmount),
      );
    }
    return res.json({
      success: true,
      uuid,
      from_amount: formatTokenValue(
        fromToken,
        route.params.fromAmount,
        fromNetwork,
      ),
      from_chain: fromNetwork.networkName,
      to_amount: formatTokenValue(toToken, route.estimate.toAmount, toNetwork),
      to_chain: toNetwork.networkName,
      duration: formatTime(route.estimate.estimatedRouteDuration),
      total_fees: totalFees,
      total_amount: formatTotalAmount(...feeCosts, fromNetwork),
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to found route" });
  }
});

// Execute swap
const Swap = z.object({
  transaction_uuid: z.string(),
});
const AXELAR_TESTNET_EXPLORER = ENVIRONMENT.IS_TESTNET
  ? "https://testnet.axelarscan.io"
  : "https://axelarscan.io";
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
    const smartAccount = await getSmartAccountFromChainData(
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
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Failed executing transaction" });
  }
});

export default router;
