import { arbitrum, sepolia } from "viem/chains";
import { getSmartAccount } from ".";
import { createPool, sql } from "slonik";
import z from "zod";
import { getSendTransaction } from "../send/smartContract";
import { IS_TESTNET, readSensitiveEnv } from "../../common/settings";
import { NATIVE_TOKEN } from "../../common/squidDB";
import { parseEther } from "viem";

const FUNDING_WALLET_ID = readSensitiveEnv("FUNDING_WALLET_ID");
const FUNDING_CHAIN = IS_TESTNET ? sepolia : arbitrum;
const FUNDING_TOKEN = IS_TESTNET
  ? NATIVE_TOKEN
  : "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const FUNDING_AMOUNT = IS_TESTNET ? parseEther("0.1") : BigInt(10000000);
const DB_USER = readSensitiveEnv("DB_USER");
const DB_NAME = readSensitiveEnv("DB_NAME");
const DB_PASSWORD = readSensitiveEnv("DB_PASSWORD");
const DB_POOL = createPool(
  `postgres://${DB_USER}:${DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${DB_NAME}`,
);
const FundCode = z.object({
  code: z.string(),
  used_by: z.string().nullable(),
});

export async function getEmberWalletAddress() {
  if (!FUNDING_WALLET_ID) return "No address;";
  const fundingAccount = await getSmartAccount(
    FUNDING_WALLET_ID,
    FUNDING_CHAIN,
  );
  return await fundingAccount.getAccountAddress();
}

export async function fundWallet(
  sender_did: string,
  username: string,
  code: string,
) {
  const dbPool = await DB_POOL;
  if (!FUNDING_WALLET_ID) throw Error("Funding is not available at the moment");

  // See if code is already used
  const availableCode = await dbPool.maybeOne(
    sql.type(
      FundCode,
    )`SELECT code, used_by FROM fund_code WHERE code = ${code}`,
  );
  if (!availableCode || availableCode.used_by !== null)
    throw Error("Code already reedemed");

  // Mark it as used and proceed to redeem
  await dbPool.query(
    sql.type(
      z.object({}),
    )`UPDATE fund_code SET used_by = ${username} WHERE code = ${code}`,
  );

  // Fund account
  const userAccount = await getSmartAccount(sender_did, FUNDING_CHAIN);
  const sendTransaction = getSendTransaction(
    FUNDING_TOKEN,
    await userAccount.getAccountAddress(),
    FUNDING_AMOUNT,
  );
  const fundingAccount = await getSmartAccount(
    FUNDING_WALLET_ID,
    FUNDING_CHAIN,
  );
  const userOp = await fundingAccount.sendTransaction(sendTransaction);
  const userOpStatus = await userOp.waitForTxHash();
  return `${FUNDING_CHAIN.blockExplorers.default.url}/tx/${userOpStatus.transactionHash}`;
}
