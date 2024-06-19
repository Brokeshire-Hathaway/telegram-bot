import fs from "node:fs";
import z from "zod";

const booleanString = z.preprocess(
  (val) => (val === "true" ? true : val === "false" ? false : val),
  z.boolean(),
);
export const Settings = z.object({
  IS_TESTNET: booleanString,
  ARBITRUM_RPC_URL: z.string().optional(),
  EMBER_CORE_URL: z.string().url().default("http://ember-core"),
  PORT: z.coerce.number().int().default(3000),
  TELEGRAM_BOT_USERNAME: z.string(),
  TELEGRAM_BOT_TOKEN: z.string(),
  SECRET_SALT: z.string(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
  DB_HOST: z.string(),
  DB_PORT: z.coerce.number().int().default(5432),
  FUNDING_WALLET_ID: z.string().optional(),
  FRONTEND_URL: z.string(),
  SQUID_INTEGRATOR_ID: z.string(),
  SQUID_DEFAULT_VERSION: z.union([z.literal(1), z.literal(2)]).default(1),
  NUMBER_OF_CODES_PER_USER: z.number().default(5),
  NUMBER_OF_MESSAGES_FOR_CONTEXT: z.number().default(5),

  // Feature flag for using's ember custom wallet implementation
  FF_EMBER_WALLET: booleanString.default(false),
});

type SettingsKeys = keyof z.infer<typeof Settings>;
const SENSITIVE_KEYS: string[] = [
  "TELEGRAM_BOT_TOKEN",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "SECRET_SALT",
  "FUNDING_WALLET_ID",
  "SQUID_INTEGRATOR_ID",
] as SettingsKeys[];
const FILE_SUFFIX = "_FILE";
function preProcessEnv() {
  const environment = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(process.env)) {
    if (
      !key.endsWith(FILE_SUFFIX) ||
      !SENSITIVE_KEYS.includes(
        key.substring(0, key.length - FILE_SUFFIX.length),
      ) ||
      !value
    ) {
      environment[key] = value;
      continue;
    }
    environment[key.substring(0, key.length - FILE_SUFFIX.length)] =
      fs.readFileSync(value, "utf8");
  }
  return environment;
}

export const ENVIRONMENT = Settings.parse(preProcessEnv());
