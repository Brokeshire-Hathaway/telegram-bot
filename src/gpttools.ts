import fetch from 'node-fetch';
import { ChatCompletionTool } from 'openai/resources';

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
            name: "get_market",
            description: "Get the current market data for a given token",
            parameters: {
                type: "object",
                properties: {
                    token_search: {
                        type: "string",
                        description: "The token to search for its market data",
                    },
                },
                required: ["token_search"],
            },
        },
    },  
];

export async function getMarket(tokenSearch: string): Promise<CoinGeckoCoinMarket> {
    const token = await getTokenIdFromCoingecko(tokenSearch);
    return await getMarketFromCoingecko(token.id);
    // Ticker | Rank
    // Price
    // 24h % Change
    // 7d % Change
    // Volume 24h
    // Market Cap
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
