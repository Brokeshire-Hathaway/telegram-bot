import express, { Request, Response } from "express";
import z from "zod";
import { Squid, RouteData } from "@0xsquid/sdk";
import { randomUUID } from "crypto";
import { UniversalAddress } from "../send/index.js";
import { type Network } from "../../chain.js";
import { getSmartAccount, getAccountAddress } from "../../account/index.js";

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
  { route: RouteData; identifier: string; network: Network }
>();

// Preview the transaction
const ChainSource = z.object({
  chain: z.string(),
  token: z.string(),
  address: z.string(),
});
const SwapPreview = z.object({
  amount: z.string(),
  sender: UniversalAddress,
  from: ChainSource.omit({ address: true }),
  to: ChainSource,
  slippage: z.number().optional().default(1.0),
});
router.post("/preview", async (req: Request, res: Response) => {
  const result = await SwapPreview.safeParseAsync(req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }
  const body = result.data;
  const account = await getSmartAccount(
    body.sender.identifier,
    body.sender.network,
  );
  try {
    const { route } = await squid.getRoute({
      fromAmount: body.amount,
      fromChain: body.from.chain,
      fromToken: body.from.token,
      fromAddress: await getAccountAddress(account),
      toChain: body.to.chain,
      toToken: body.to.token,
      toAddress: body.to.address,
      slippage: body.slippage,
    });
    const uuid = randomUUID();
    TRANSACTION_MEMORY.set(uuid, {
      route,
      identifier: body.sender.identifier,
      network: body.sender.network,
    });
    return res.json({
      success: true,
      uuid,
      estimate_amount: route.estimate.toAmount,
      exchange_rate: route.estimate.exchangeRate,
      duration: route.estimate.estimatedRouteDuration,
      fee_costs: route.estimate.feeCosts,
      gas_costs: route.estimate.gasCosts,
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
    if (!memory.route.transactionRequest) {
      TRANSACTION_MEMORY.delete(body.transaction_uuid);
      return res
        .status(500)
        .json({ success: false, message: "No contract to execute" });
    }

    const smartAccount = await getSmartAccount(
      memory.identifier,
      memory.network,
    );

    // Create user operation with gas limits
    const userOp = await smartAccount.buildUserOp(
      [
        {
          to: memory.route.transactionRequest.targetAddress,
          value: memory.route.transactionRequest.value,
          data: memory.route.transactionRequest.data,
        },
      ],
      {
        skipBundlerGasEstimation: true,
        overrides: {
          maxFeePerGas: memory.route.transactionRequest.maxFeePerGas,
          maxPriorityFeePerGas:
            memory.route.transactionRequest.maxPriorityFeePerGas,
          callGasLimit: memory.route.transactionRequest.gasLimit,
          verificationGasLimit: memory.route.transactionRequest.gasLimit,
        },
      },
    );

    const responseUserOp = await smartAccount.sendUserOp(userOp);
    const transactionHash = await responseUserOp.waitForTxHash();
    TRANSACTION_MEMORY.delete(body.transaction_uuid);
    return res.json({
      hash: transactionHash.transactionHash,
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Failed executing transaction" });
  }
});

export default router;
