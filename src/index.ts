import { ENVIRONMENT } from "./common/settings.js";
import { startTelegramBot } from "./features/bot/index.js";

async function main() {
  startTelegramBot();
  console.log(
    "Running telegram bot for user",
    ENVIRONMENT.TELEGRAM_BOT_USERNAME,
  );
}

main();
