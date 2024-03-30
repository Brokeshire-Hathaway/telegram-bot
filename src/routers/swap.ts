import express, { Request, Response } from 'express';
import z from 'zod';
import { Squid } from "@0xsquid/sdk"

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
    return res.json(await squid.getRoute({
        fromAmount: body.amount,
        fromChain: body.from.chain,
        fromToken: body.from.token,
        fromAddress: body.from.address,
        toChain: body.to.chain,
        toToken: body.to.token,
        toAddress: body.to.address,
        slippage: body.slippage,
    }));

})

export default router;