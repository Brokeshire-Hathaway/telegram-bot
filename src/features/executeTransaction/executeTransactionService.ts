// Import necessary libraries with ES6 import syntax
import express from 'express';
import bodyParser from 'body-parser';

// Create the express application
const app = express();
const port = 3000; // Default port for the application

// Use bodyParser middleware to parse JSON bodies
app.use(bodyParser.json());

// Mock function to 'prepare' a transaction - in a real app, this would interact with a database or a blockchain
const prepareTransaction = (transactionData: any) => {
    console.log("Preparing transaction:", transactionData);
    // Here, you would add logic to prepare the transaction, such as validating it, saving it to a database, or interacting with a blockchain.
    return { success: true, message: "Transaction prepared successfully" };
};

// PUT endpoint for /transactions
app.put('/transactions', (req, res) => {
    const { sender_did, recipient_did, amount, is_native_token, receive_token_address } = req.body;

    // Validate the input here as needed
    if (!sender_did || !recipient_did || !amount) {
        return res.status(400).json({ success: false, message: "Missing required transaction fields" });
    }

    // Prepare the transaction
    const transactionResult = prepareTransaction(req.body);

    // Respond with success or failure
    if (transactionResult.success) {
        res.json({ success: true, message: transactionResult.message });
    } else {
        res.status(500).json({ success: false, message: "Failed to prepare transaction" });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Transaction service running at http://localhost:${port}`);
});

export default app; // Export the app for testing purposes

