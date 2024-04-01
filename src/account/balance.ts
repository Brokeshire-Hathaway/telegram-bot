import Moralis from "moralis";
import {
  EvmChain,
  GetTokenPriceResponseAdapter,
} from "moralis/common-evm-utils";
import PreciseNumber from "../common/tokenMath.js";

// https://docs.moralis.io/supported-chains
const moralisMainnet = EvmChain.ETHEREUM;
const moralisTestnet = EvmChain.SEPOLIA;
const wrappedNativeToken = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
type TokenStandardization = "erc20" | "native";
type GetWalletTokenBalance = {
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
  possible_spam: boolean;
  standardization: TokenStandardization;
  token_address: string | null;
  logo?: string | undefined;
  thumbnail?: string | undefined;
  verified_collection?: boolean | undefined;
};
export type WalletTokenBalance = GetWalletTokenBalance & {
  usdBalance: string | null;
};
export async function getAccountBalances(
  address: `0x${string}`,
): Promise<WalletTokenBalance[]> {
  const nativeBalanceResponse = await Moralis.EvmApi.balance.getNativeBalance({
    address,
    chain: moralisTestnet,
  });
  const nativeBalance = nativeBalanceResponse.toJSON().balance;
  const formattedNativeBalance: GetWalletTokenBalance = {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    balance: nativeBalance,
    possible_spam: false,
    standardization: "native",
    token_address: null,
  };
  const usdNativeBalance = await getUsdTokenBalances([formattedNativeBalance]);

  const tokenBalancesResponse =
    await Moralis.EvmApi.token.getWalletTokenBalances({
      address,
      chain: moralisTestnet,
    });
  console.log(`tokenBalancesResponse`);
  console.log(tokenBalancesResponse);
  const tokenBalances: GetWalletTokenBalance[] = tokenBalancesResponse
    .toJSON()
    .filter((tokenBalance) => !tokenBalance.possible_spam)
    .map((tokenBalance) => ({ ...tokenBalance, standardization: "erc20" }));
  const usdTokenBalances = await getUsdTokenBalances(tokenBalances);

  return [...usdNativeBalance, ...usdTokenBalances];
}

async function getUsdTokenBalances(
  balances: GetWalletTokenBalance[],
): Promise<WalletTokenBalance[]> {
  return await Promise.all(
    balances.map(async (tokenBalance) => {
      const address = tokenBalance.token_address ?? wrappedNativeToken;
      let tokenPriceResponse: GetTokenPriceResponseAdapter;
      try {
        tokenPriceResponse = await Moralis.EvmApi.token.getTokenPrice({
          address,
          chain: moralisMainnet,
        });
      } catch (error) {
        console.warn(`# Error\n${error}`);
        return { ...tokenBalance, usdBalance: null };
      }
      const tokenPrice = String(tokenPriceResponse.toJSON().usdPrice);
      console.log(`tokenPriceResponse`);
      console.log(tokenPriceResponse.toJSON());
      const usdBalance = PreciseNumber.bigMultiply(
        PreciseNumber.from(tokenBalance.balance, tokenBalance.decimals),
        PreciseNumber.from(tokenPrice),
      ).toDecimalString();
      return { ...tokenBalance, usdBalance };
    }),
  );
}
