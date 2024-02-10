import express from 'express';
import bodyParser from 'body-parser';
import { executeTransaction, sendTokenPreview } from '../../gpttools.js';
import { UUID } from 'crypto';

interface PrepareTransactionBody {
    sender_address: UniversalAddress;
    recipient_address: UniversalAddress;
    amount: string;
    is_receive_native_token: boolean;
    receive_token_address: `0x${string}` | undefined;
}

interface SendTransactionBody {
    transaction_uuid: UUID;
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
    console.log("REQUEST BODY")
    console.log(req.body);
    if (!isValidPrepareTransactionBody(req.body)) {
        return res.status(400).json({ success: false, message: "Invalid request body" });
    }
    try {
        const preview = await sendTokenPreview({
            accountUid: req.body.sender_address.identifier,
            recipientAddress: req.body.recipient_address.identifier as `0x${string}`,
            amount: req.body.amount,
            standardization: req.body.is_receive_native_token ? "native" : "erc20",
            tokenAddress: req.body.receive_token_address as `0x${string}` | undefined
        });
        res.json(preview);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: `Error: ${error}` });
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
        res.status(500).json({ success: false, message: `Error: ${error}` });
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
    
    if (typeof address !== 'object') {
        throw new Error("Address is not an object")
    }
    if (typeof address.network !== 'string') {
        throw new Error("Address network is not a string")
    }
    if (typeof address.identifier !== 'string') {
        throw new Error("Address identifier is not a string")
    }
    if (typeof address.platform !== 'string') {
        throw new Error("Address platform is not a string")
    }

    return true;
}

function isValidPrepareTransactionBody(body: any): body is PrepareTransactionBody {
    console.warn(`body: ${JSON.stringify(body)}`);
    console.warn(body);

    if (typeof body !== 'object') {
        throw new Error("Body is not an object")
    }
    isValidUniversalAddress(body.sender_address);
    isValidUniversalAddress(body.recipient_address);
    if (typeof body.amount !== 'string') {
        throw new Error("Amount is not a string")
    }
    if (isNaN(parseFloat(body.amount))) {
        throw new Error("Amount is not a number")
    }
    if (typeof body.is_receive_native_token !== 'boolean') {
        throw new Error("Is native token is not a boolean")
    }

    console.warn(`body.receive_token_address: ${body.receive_token_address}`);
    console.warn(typeof body.receive_token_address);

    if (body.receive_token_address != null) {
        if (typeof body.receive_token_address !== 'string' || !/^0x[a-fA-F0-9]+$/.test(body.receive_token_address)) {
            throw new Error("Receive token address is an invalid token address")
        }
    }

    return true;
}

function isValidSendTransactionBody(body: any): body is SendTransactionBody {
    console.warn(`body: ${JSON.stringify(body)}`);
    console.warn(body);

    if (typeof body !== 'object') {
        throw new Error("Body is not an object")
    }
    if (typeof body.transaction_uuid !== 'string') {
        throw new Error("Transaction UUID is not a string")
    }

    return true;
}

export default app; // Export the app for testing purposes

