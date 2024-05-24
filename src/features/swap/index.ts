import express, { Request, Response } from "express";
import z from "zod";
import { UniversalAddress } from "../send/index.js";
import { costsToUsd } from "../../common/formatters.js";
import {
  RouteType,
  getNetworkInformation,
  getRoute,
  getTokenInformation,
  routeFeesToTokenMap,
} from "../../common/squidDB.js";
import { createTransaction } from "../frontendApi/common.js";

// Create the router
const router = express.Router();

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
  if (!fromNetwork)
    return res
      .status(500)
      .json({ success: false, message: "Network not supported" });
  const toNetwork = getNetworkInformation(body.to.network);
  if (!toNetwork)
    return res
      .status(500)
      .json({ success: false, message: "Network not supported" });
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

    // Swap fee costs
    const feeCosts = await routeFeesToTokenMap(
      route.estimate.feeCosts,
      route.estimate.gasCosts,
    );
    const fees = costsToUsd(...feeCosts);
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
    const uuid = await createTransaction(
      {
        total: costsToUsd(...feeCosts),
        fees,
        call_gas_limit: BigInt(route.transactionRequest.gasLimit),
        max_fee_per_gas: BigInt(route.transactionRequest.maxFeePerGas),
        max_priority_fee_per_gas: BigInt(
          route.transactionRequest.maxPriorityFeePerGas,
        ),
      },
      [
        {
          amount: BigInt(route.estimate.fromAmount),
          token: fromToken.symbol,
          token_address: fromToken.address as `0x${string}`,
          chain: fromNetwork.networkName,
          chain_id: fromNetwork.chainId.toString(),
          type: "swap",
          address: "OWNER",
        },
        {
          amount: BigInt(route.estimate.toAmount),
          token: toToken.symbol,
          token_address: toToken.address as `0x${string}`,
          chain: toNetwork.networkName,
          chain_id: toNetwork.chainId.toString(),
          address: "OWNER",
        },
      ],
    );
    return res.json({
      success: true,
      uuid,
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to found route" });
  }
});

export default router;
