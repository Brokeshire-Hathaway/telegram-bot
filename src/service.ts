import express from 'express';
import bodyParser from 'body-parser';
import sendRouter from "./routers/send.js";
const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';
app.use(bodyParser.json());

// Endpoints router
app.use("/transactions", sendRouter);
export function startTransactionService() {
    // Log when starting service
    app.listen(PORT, async () => {
        console.log(`Transaction service running at http://${HOST}:${PORT}`);
        return HOST;
    });


}

export default app; // Export the app for testing purposes