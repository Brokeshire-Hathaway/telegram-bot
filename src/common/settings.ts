import fs from "node:fs";

export function readSensitiveEnv(name: string) {
  if (process.env[name]) return process.env[name];
  const envFile = process.env[`${name}_FILE`];
  if (!envFile) return;
  return fs.readFileSync(envFile, "utf8");
}

export const IS_TESTNET = (process.env.IS_TESTNET || "true") === "true";

export const ARBITRUM_RPC_URL = process.env.ARBITRUM_RPC_URL;
