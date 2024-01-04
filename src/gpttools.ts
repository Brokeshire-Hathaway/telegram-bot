import { UUID, randomUUID } from 'crypto';
import { ChatCompletionTool } from 'openai/resources/index';
import { calculateGasFee, sendTransaction, prepareSendToken } from './smartAccount.js';
import PreciseNumber from './common/tokenMath.js';
import { UserOperation } from '@biconomy/core-types';
import { formatEther } from 'viem';

interface CoinGeckoSearchCoin {
    id: string;
    name: string;
    api_symbol: string;
    symbol: string;
    market_cap_rank: number,
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
    roi: null,
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

export async function getMarket(args: GetMarketArgs): Promise<CoinGeckoCoinMarket> {
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
    recipientAddress: `0x${string}`;
    amount: string;
    standardization: "native" | "erc20";
    tokenAddress?: `0x${string}`;
}

interface SendTokenPreview {
    recipient: `0x${string}`;
    amount: string;
    tokenSymbol: string;
    gasFee: string;
    totalAmount: string;
    transactionUuid: UUID;
}

type TransactionPreview = [accountUid: string, preview: SendTokenPreview, userOp: Partial<UserOperation>];

const userOps: Record<UUID, TransactionPreview> = {};

export async function sendTokenPreview(args: SendTokenPreviewArgs): Promise<SendTokenPreview> {
    const transactionUuid = randomUUID();
    const userOp = await prepareSendToken(args.accountUid, args.recipientAddress, PreciseNumber.from(args.amount), args.tokenAddress);
    const gasFee = calculateGasFee(userOp);
    const totalAmount = formatEther(gasFee.integer + PreciseNumber.from(args.amount).integer);
    const sendTokenPreview: SendTokenPreview = {
        recipient: args.recipientAddress,
        amount: args.amount,
        tokenSymbol: args.tokenAddress ?? "ETH",
        gasFee: gasFee.toDecimalString(),
        totalAmount,
        transactionUuid
    };

    userOps[transactionUuid] = [args.accountUid, sendTokenPreview, userOp];

    return sendTokenPreview;
}
interface ExecuteTransactionArgs {
    transactionUuid: UUID;
}

interface UserReceipt {
    status: "pending" | "success" | "failure";
    recipient: `0x${string}`;
    amount: string;
    tokenSymbol: string;
    gasFee: string;
    totalAmount: string;
    transactionHash: string;
    transactionUuid: UUID;
    reason?: string;
}

const userOpReceipts: Record<UUID, UserReceipt> = {};

export async function executeTransaction(args: ExecuteTransactionArgs) {
    const txPreview = userOps[args.transactionUuid];

    if (!txPreview) {
        throw new Error(`Transaction UUID "${args.transactionUuid}" not found.`);
    }

    const userOpReceipt = await sendTransaction(txPreview[0], txPreview[2]);
    console.log(`executeTransaction - userOpReceipt`);
    console.log(userOpReceipt);

    console.log(`executeTransaction - userOpReceipt.actualGasUsed`);
    console.log(userOpReceipt.actualGasUsed);
    console.log(String(userOpReceipt.actualGasUsed));

    const bigGasFee = PreciseNumber.from(userOpReceipt.paymaster === "0x" ? "0" : String(userOpReceipt.actualGasCost))
    const userReceipt: UserReceipt = {
        status: userOpReceipt.success ? "success" : "failure",
        recipient: txPreview[1].recipient,
        amount: txPreview[1].amount,
        tokenSymbol: txPreview[1].tokenSymbol,
        gasFee: bigGasFee.toDecimalDisplay(8),
        totalAmount: PreciseNumber.bigAdd(PreciseNumber.from(txPreview[1].amount), bigGasFee).toDecimalDisplay(8),
        transactionHash: userOpReceipt.receipt.transactionHash,
        transactionUuid: args.transactionUuid,
        reason: userOpReceipt.reason,
    };

    userOpReceipts[args.transactionUuid] = userReceipt;

    console.log(`executeTransaction - userReceipt`);
    console.log(userReceipt);

    return userReceipt;
};

async function getTokenIdFromCoingecko(tokenSearch: string): Promise<CoinGeckoSearchCoin> {
    const response = await fetch(`https://api.coingecko.com/api/v3/search?query=${tokenSearch}`);
    if (!response.ok) {
        throw new Error(`Error fetching token list: ${response.statusText}`);
    }
    const searchRes = await response.json() as CoinGeckoSearchResponse;
    if (!searchRes || !searchRes.coins || searchRes.coins.length === 0) {
        throw new Error(`Token "${tokenSearch}" not found.`);
    }
    return searchRes.coins[0];
};

async function getMarketFromCoingecko(tokenId: string): Promise<CoinGeckoCoinMarket> {
    const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${tokenId}&order=market_cap_desc&per_page=1&page=1&sparkline=false&price_change_percentage=24h%2C7d&locale=en`);
    if (!response.ok) {
        throw new Error(`Error fetching token market: ${response.statusText}`);
    }
    const searchRes = await response.json() as CoinGeckoMarketResponse;
    if (!searchRes || searchRes.length === 0) {
        throw new Error(`Token market not found for token ID "${tokenId}".`);
    }
    return searchRes[0];
}
