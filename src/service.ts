import express from "express";
import bodyParser from "body-parser";
import sendRouter from "./features/send";
import swapRouter from "./features/swap";
import frontendApiRouter from "./features/frontend_api";
import { initSquid } from "./common/squidDB";
import { ENVIRONMENT } from "./common/settings";

// Create express app
const app = express();
const HOST = "0.0.0.0";
app.use(bodyParser.json());

// Endpoints router
app.use((req, res, next) => {
  console.info();
  console.info("======= Request incoming", new Date(), "=======");
  console.info("Endpoint", req.path, req.method);
  console.info("");
  next();
});
app.use("/send", sendRouter);
app.use("/swap", swapRouter);
app.use("/api", frontendApiRouter);

export function startTransactionService() {
  // Log when starting service
  app.listen(ENVIRONMENT.PORT, async () => {
    console.log(
      `Transaction service running at http://${HOST}:${ENVIRONMENT.PORT}`,
    );
    await initSquid();
    return HOST;
  });
}

export default app; // Export the app for testing purposes
