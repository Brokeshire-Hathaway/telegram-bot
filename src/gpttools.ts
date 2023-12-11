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

interface SendTokenPreview {
    recipient: `0x${string}`;
    amount: string;
    tokenSymbol: string;
    gasFee: string;
    totalAmount: string;
    transactionUuid: UUID;
}

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
            name: "sendTokenPreview",
            description: "Prepare a transaction to send a token to a recipient and return a preview of what will happen",
            parameters: {
                type: "object",
                properties: {
                    accountUid: {
                        type: "string",
                        description: "Sender account UID",
                    },
                    recipient: {
                        type: "string",
                        description: "Ethereum address of the recipient",
                    },
                    amount: {
                        type: "string",
                        description: "Amount of the token to send",
                    },
                    tokenAddress: {
                        type: "string",
                        description: "Optional address of the token to send. If not specified, the native network token will be sent.",
                    },
                },
                required: ["accountUid", "recipient", "amount"],
            },
        },
    }, 
    {
        type: "function",
        function: {
            name: "executeTransaction",
            description: "Execute a transaction from a transaction UUID obtained from sendTokenPreview",
            parameters: {
                type: "object",
                properties: {
                    transactionUuid: {
                        type: "string",
                        description: "UUID of the transaction to execute",
                    },
                },
                required: ["transactionUuid"],
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
    recipient: `0x${string}`;
    amount: string;
    token?: `0x${string}`;
}

type TransactionPreview = [accountUid: string, userOp: Partial<UserOperation>];

const userOps: Record<UUID, TransactionPreview> = {};

export async function sendTokenPreview(args: SendTokenPreviewArgs): Promise<SendTokenPreview> {
    const transactionUuid = randomUUID();
    const userOp = await prepareSendToken(args.accountUid, args.recipient, PreciseNumber.from(args.amount), args.token);

    userOps[transactionUuid] = [args.accountUid, userOp];

    const gasFee = calculateGasFee(userOp);
    const totalAmount = formatEther(gasFee.integer + PreciseNumber.from(args.amount).integer);
    return {
        recipient: args.recipient,
        amount: args.amount,
        tokenSymbol: args.token ?? "ETH",
        gasFee: gasFee.toDecimalString(),
        totalAmount,
        transactionUuid
    };
}
interface ExecuteTransactionArgs {
    transactionUuid: UUID;
}

export async function executeTransaction(args: ExecuteTransactionArgs) {
    const txPreview = userOps[args.transactionUuid];
    if (!txPreview) {
        throw new Error(`Transaction UUID "${args.transactionUuid}" not found.`);
    }
    const receipt = await sendTransaction(txPreview[0], txPreview[1]);
    return receipt;
}

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
}

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
