export const USD_DECIMALS = 6;

interface CoingeckoToken {
  id: string;
}
export async function getCoingeckoToken<S>(search: S) {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/search?query=${search}`,
  );
  if (!response.ok) return undefined;
  const coinsResponse = await response.json();
  if (coinsResponse.coins.length === 0) return undefined;
  const token = coinsResponse.coins[0];
  return token as CoingeckoToken;
}

interface UsdPrice {
  [key: string]: {
    usd: number;
  };
}
export async function addUsdPriceToToken<T extends { decimals: number }>(
  token: T,
  coingeckoToken: Pick<CoingeckoToken, "id">,
) {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoToken.id}&vs_currencies=usd`,
  );
  if (!response.ok) return undefined;
  const usdPrice: UsdPrice = await response.json();
  return {
    usdPrice: usdPrice[coingeckoToken.id].usd,
    ...token,
  };
}

export async function findUsdPrice<T extends { decimals: number }>(
  token: T,
  tokenName: keyof T,
): Promise<(T & { usdPrice: number }) | undefined> {
  const coingeckoToken = await getCoingeckoToken(token[tokenName]);
  if (!coingeckoToken) return undefined;
  return await addUsdPriceToToken(token, coingeckoToken);
}
