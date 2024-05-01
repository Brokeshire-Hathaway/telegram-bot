import express from "express";
import bodyParser from "body-parser";
import sendRouter from "./features/send/index.js";
import swapRouter from "./features/swap/index.js";
import { initSquid } from "./common/squidDB.js";

// Create express app
const app = express();
const PORT = 3000;
const HOST = "0.0.0.0";
app.use(bodyParser.json());

// Endpoints router
app.use("/transactions", sendRouter);
app.use("/swap", swapRouter);

export function startTransactionService() {
  // Log when starting service
  app.listen(PORT, async () => {
    console.log(`Transaction service running at http://${HOST}:${PORT}`);
    await initSquid();
    return HOST;
  });
}

export default app; // Export the app for testing purposes
