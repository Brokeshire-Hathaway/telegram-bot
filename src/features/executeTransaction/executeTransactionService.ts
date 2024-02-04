import express from 'express';
import bodyParser from 'body-parser';
import { executeTransaction, sendTokenPreview } from '../../gpttools.js';
import { UUID } from 'crypto';

interface PrepareTransactionBody {
    sender_address: UniversalAddress;
    recipient_address: UniversalAddress;
    amount: string;
    is_native_token: boolean;
    receive_token_address: `0x${string}` | undefined;
}

interface SendTransactionBody {
    transactionUuid: UUID;
}

interface UniversalAddress {
    network: string;
    identifier: string;
    platform: string;
}

// Create the express application
const app = express();
const port = 3000; // Default port for the application

// Use bodyParser middleware to parse JSON bodies
app.use(bodyParser.json());

// Endpoint to prepare a transaction
app.post('/transactions/prepare', async (req, res) => {
    if (!isValidPrepareTransactionBody(req.body)) {
        return res.status(400).json({ success: false, message: "Invalid request body" });
    }
    try {
        const preview = await sendTokenPreview({
        accountUid: req.body.sender_address.identifier,
        recipientAddress: req.body.recipient_address.identifier as `0x${string}`,
        amount: req.body.amount,
        standardization: req.body.is_native_token ? "native" : "erc20",
        tokenAddress: req.body.receive_token_address as `0x${string}` | undefined
        });
        res.json(preview);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to prepare transaction" });
    }
});

// Endpoint to send a prepared transaction
app.post('/transactions/send', async (req, res) => {
    if (!isValidSendTransactionBody(req.body)) {
        return res.status(400).json({ success: false, message: "Invalid request body" });
    }
    try {
        const sendResult = await executeTransaction(req.body);
        res.json(sendResult);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to send transaction" });
    }
});

export function startTransactionService() {
    app.listen(port, () => {
        console.log(`Transaction service running at http://localhost:${port}`);
    });
}

function isValidUniversalAddress(address: any): address is UniversalAddress {
    console.warn(`address: ${JSON.stringify(address)}`);
    console.warn(address);
    return typeof address === 'object' &&
        typeof address.network === 'string' &&
        typeof address.identifier === 'string' &&
        typeof address.platform === 'string';
}

function isValidPrepareTransactionBody(body: any): body is PrepareTransactionBody {
    console.warn(`body: ${JSON.stringify(body)}`);
    console.warn(body);
    return typeof body === 'object' &&
        isValidUniversalAddress(body.sender_address) &&
        isValidUniversalAddress(body.recipient_address) &&
        typeof body.amount === 'string' && !isNaN(parseFloat(body.amount)) &&
        typeof body.is_native_token === 'boolean' &&
        (typeof body.receive_token_address === 'string' &&
        /^0x[a-fA-F0-9]+$/.test(body.receive_token_address)) || typeof body.receive_token_address === 'undefined';
}

function isValidSendTransactionBody(body: any): body is SendTransactionBody {
    console.warn(`body: ${JSON.stringify(body)}`);
    console.warn(body);
    return typeof body === 'object' &&
        typeof body.transactionUuid === 'string';
}

export default app; // Export the app for testing purposes

