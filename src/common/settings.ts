import fs from "node:fs";
import z from "zod";

const booleanString = z.preprocess(
  (val) => (val === "true" ? true : val === "false" ? false : val),
  z.boolean(),
);
export const Settings = z.object({
  EMBER_API_URL: z.string().url().default("http://ember-core"),
  TELEGRAM_BOT_USERNAME: z.string(),
  TELEGRAM_BOT_TOKEN: z.string(),
  FF_EMBER_WALLET: booleanString.default(false),
});

type SettingsKeys = keyof z.infer<typeof Settings>;
const SENSITIVE_KEYS: string[] = ["TELEGRAM_BOT_TOKEN"] as SettingsKeys[];
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
