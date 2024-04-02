import { randomUUID } from "crypto";
import { ChatCompletionTool } from "openai/resources/index";
import {
  calculateGasFee,
  sendTransaction,
  prepareSendToken,
} from "./features/send/account.js";
import PreciseNumber from "./common/tokenMath.js";
import { UserOperation } from "@biconomy/core-types";
import { formatEther } from "viem";
import { type Network } from "./chain.js";
import { getSmartAccount } from "./account/index.js";

interface CoinGeckoSearchCoin {
  id: string;
  name: string;
  api_symbol: string;
  symbol: string;
  market_cap_rank: number;
  thumb: string;
  large: string;
}

interface CoinGeckoSearchResponse {
  coins: CoinGeckoSearchCoin[];
}

interface CoinGeckoCoinMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  roi: null;
  last_updated: string;
  price_change_percentage_24h_in_currency: number;
  price_change_percentage_7d_in_currency: number;
}

type CoinGeckoMarketResponse = Array<CoinGeckoCoinMarket>;

export const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "getMarket",
      description: "Get the current market data for a given token",
      parameters: {
        type: "object",
        properties: {
          token_search: {
            type: "string",
            description: "The token to search for its market data",
          },
        },
        required: ["tokenSearch"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sendToken",
      description: "Send a cryptocurrency token to a recipient",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

interface GetMarketArgs {
  tokenSearch: string;
}

export async function getMarket(
  args: GetMarketArgs,
): Promise<CoinGeckoCoinMarket> {
  const token = await getTokenIdFromCoingecko(args.tokenSearch);
  return await getMarketFromCoingecko(token.id);
  // Ticker | Rank
  // Price
  // 24h % Change
  // 7d % Change
  // Volume 24h
  // Market Cap
}

interface SendTokenPreviewArgs {
  accountUid: string;
  network: Network;
  recipientAddress: `0x${string}`;
  amount: string;
  standardization: "native" | "erc20";
  tokenAddress?: `0x${string}`;
}

interface SendTokenPreview {
  recipient: `0x${string}`;
  amount: string;
  token_symbol: string;
  gas_fee: string;
  total_amount: string;
  transaction_uuid: string;
}

type TransactionPreview = [
  accountUid: string,
  preview: SendTokenPreview,
  userOp: Partial<UserOperation>,
  network: Network,
];

const TRANSACTION_MEMORY: Record<string, TransactionPreview> = {};

export async function sendTokenPreview(
  args: SendTokenPreviewArgs,
): Promise<SendTokenPreview> {
  const transactionUuid = randomUUID();
  const smartAccount = await getSmartAccount(args.accountUid, args.network);
  const userOp = await prepareSendToken(
    smartAccount,
    args.recipientAddress,
    PreciseNumber.from(args.amount),
    args.tokenAddress,
  );
  const gasFee = calculateGasFee(userOp);
  const totalAmount = formatEther(
    gasFee.integer + PreciseNumber.from(args.amount).integer,
  );
  const sendTokenPreview: SendTokenPreview = {
    recipient: args.recipientAddress,
    amount: args.amount,
    token_symbol: args.tokenAddress ?? "ETH",
    gas_fee: gasFee.toDecimalString(),
    total_amount: totalAmount,
    transaction_uuid: transactionUuid,
  };

  TRANSACTION_MEMORY[transactionUuid] = [
    args.accountUid,
    sendTokenPreview,
    userOp,
    args.network,
  ];

  return sendTokenPreview;
}
interface ExecuteTransactionArgs {
  transaction_uuid: string;
}

interface UserReceipt {
  status: "pending" | "success" | "failure";
  recipient: `0x${string}`;
  amount: string;
  token_symbol: string;
  gas_fee: string;
  total_amount: string;
  transaction_hash: string;
  transaction_uuid: string;
  reason?: string;
}

const userOpReceipts: Record<string, UserReceipt> = {};

export async function executeTransaction(args: ExecuteTransactionArgs) {
  const txPreview = TRANSACTION_MEMORY[args.transaction_uuid];

  if (!txPreview) {
    throw new Error(`Transaction UUID "${args.transaction_uuid}" not found.`);
  }

  const smartAccount = await getSmartAccount(txPreview[0], txPreview[3]);
  const userOpReceipt = await sendTransaction(smartAccount, txPreview[2]);
  console.log(`executeTransaction - userOpReceipt`);
  console.log(userOpReceipt);

  console.log(`executeTransaction - userOpReceipt.actualGasUsed`);
  console.log(userOpReceipt.actualGasUsed);
  console.log(String(userOpReceipt.actualGasUsed));

  const bigGasFee = PreciseNumber.from(
    userOpReceipt.paymaster === "0x"
      ? String(userOpReceipt.actualGasCost)
      : "0",
  );
  const userReceipt: UserReceipt = {
    status: userOpReceipt.success ? "success" : "failure",
    recipient: txPreview[1].recipient,
    amount: txPreview[1].amount,
    token_symbol: txPreview[1].token_symbol,
    gas_fee: bigGasFee.toDecimalDisplay(8),
    total_amount: PreciseNumber.bigAdd(
      PreciseNumber.from(txPreview[1].amount),
      bigGasFee,
    ).toDecimalDisplay(8),
    transaction_hash: userOpReceipt.receipt.transactionHash,
    transaction_uuid: args.transaction_uuid,
    reason: userOpReceipt.reason,
  };

  userOpReceipts[args.transaction_uuid] = userReceipt;

  console.log(`executeTransaction - userReceipt`);
  console.log(userReceipt);

  return userReceipt;
}

async function getTokenIdFromCoingecko(
  tokenSearch: string,
): Promise<CoinGeckoSearchCoin> {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/search?query=${tokenSearch}`,
  );
  if (!response.ok) {
    throw new Error(`Error fetching token list: ${response.statusText}`);
  }
  const searchRes = (await response.json()) as CoinGeckoSearchResponse;
  if (!searchRes || !searchRes.coins || searchRes.coins.length === 0) {
    throw new Error(`Token "${tokenSearch}" not found.`);
  }
  return searchRes.coins[0];
}

async function getMarketFromCoingecko(
  tokenId: string,
): Promise<CoinGeckoCoinMarket> {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${tokenId}&order=market_cap_desc&per_page=1&page=1&sparkline=false&price_change_percentage=24h%2C7d&locale=en`,
  );
  if (!response.ok) {
    throw new Error(`Error fetching token market: ${response.statusText}`);
  }
  const searchRes = (await response.json()) as CoinGeckoMarketResponse;
  if (!searchRes || searchRes.length === 0) {
    throw new Error(`Token market not found for token ID "${tokenId}".`);
  }
  return searchRes[0];
}
