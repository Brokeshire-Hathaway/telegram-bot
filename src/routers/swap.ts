import express, { Request, Response } from 'express';
import z from 'zod';
import { Squid, RouteData } from "@0xsquid/sdk"
import { getSigner } from '../smartAccount.js';
import { randomUUID } from 'crypto';

// Squid object
const squid = new Squid({
    baseUrl: "https://testnet.api.squidrouter.com",
});
export async function initSquid() {
    await squid.init();
}

// Create the router
const router = express.Router();

// Preview the transaction
const ChainSource = z.object({
    chain: z.string(),
    token: z.string(),
    address: z.string()
});
const SwapPreview = z.object({
    amount: z.string(),
    from: ChainSource,
    to: ChainSource,
    slippage: z.number().optional().default(1.00)
});
router.post("/preview", async (req: Request, res: Response) => {
    const result = await  SwapPreview.safeParseAsync(req.body);
    if (!result.success) {
        return res.status(400).json(result);
    }
    const body = result.data;
    const { route } = await squid.getRoute({
        fromAmount: body.amount,
        fromChain: body.from.chain,
        fromToken: body.from.token,
        fromAddress: body.from.address,
        toChain: body.to.chain,
        toToken: body.to.token,
        toAddress: body.to.address,
        slippage: body.slippage,
    });
    return res.json({ success: true, route });

})

// Execute swap
const squid_route = z.custom<RouteData>((val) => {
  return typeof val === "object";
});
const Swap = z.object({
    squid_route: squid_route
});
router.post("/", async (req: Request, res: Response) => {
    const result = await Swap.safeParseAsync(req.body);
    if (!result.success) {
        return res.status(400).json(result);
    }
    const body = result.data;
    try {
        const uuid = randomUUID();
        const signer = await getSigner(uuid);
        const transaction = await squid.executeRoute({
            route: body.squid_route,
            signer
        });
        return res.json(transaction);
    } catch (err) {
        console.log(err)
        res.status(500).json({success: false, message: "Failed executing transaction"});
    }

})

export default router;