import { startTelegramBot } from "./telegramBot.js";
import { startTransactionService } from "./service.js";

async function main() {
  startTelegramBot();
  startTransactionService();
  console.log("\n...ready");
}

main();
