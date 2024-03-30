import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { executeTransaction, sendTokenPreview } from '../../gpttools.js';
import z from 'zod';

// Create the express application
const app = express();
const port = 3000;
app.use(bodyParser.json());

// Endpoint to prepare a transaction
const token_address = z.custom<`0x${string}`>((val) => {
  return typeof val === "string" ? /^0x[a-fA-F0-9]+$/.test(val) : false;
});
const UniversalAddress = z.object({
    network: z.string(),
    identifier: z.string(),
    platform: z.string(),
});
const PrepareTransactionBody = z.object({
    sender_address: UniversalAddress,
    recipient_address: UniversalAddress,
    amount: z.string(),
    is_receive_native_token: z.boolean(),
    receive_token_address: token_address.optional()
})

app.post('/transactions/prepare', async (req: Request, res: Response) => {
    const result = await PrepareTransactionBody.safeParseAsync(req.body);
    if (!result.success) {
        return res.status(400).json({ success: false, message: "Invalid request body" });
    }
    const body = result.data;
    try {
        const preview = await sendTokenPreview({
            accountUid: body.sender_address.identifier,
            recipientAddress: body.recipient_address.identifier as `0x${string}`,
            amount: body.amount,
            standardization: body.is_receive_native_token ? "native" : "erc20",
            tokenAddress: body.receive_token_address
        });
        res.json(preview);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: `Error: ${error}` });
    }
});

// Endpoint to send a prepared transaction
const SendTransactionBody = z.object({
    transaction_uuid: z.string().uuid()
});

app.post('/transactions/send', async (req: Request, res: Response) => {
    const result = await SendTransactionBody.safeParseAsync(req.body);
    if (!result.success) {
        return res.status(400).json({ success: false, message: "Invalid request body" });
    }
    const body = result.data;
    try {
        const sendResult = await executeTransaction(body);
        res.json(sendResult);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: `Error: ${error}` });
    }
});

export function startTransactionService() {
    const HOST = '0.0.0.0';
    app.listen(port, () => {
        console.log(`Transaction service running at http://${HOST}:${port}`);
        return HOST;
    });
}

export default app; // Export the app for testing purposes
