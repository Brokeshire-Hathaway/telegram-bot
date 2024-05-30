import { ChainData, Token } from "@0xsquid/squid-types";
import { formatUnits, parseUnits } from "viem";
import { TokenInformation } from "./squidDB";

export function formatTime(timeInSeconds: number) {
  if (timeInSeconds <= 1) {
    return `< 1 second`;
  }
  if (timeInSeconds < 60) {
    return `${timeInSeconds} seconds`;
  }
  return `${(timeInSeconds / 60).toFixed(1)} minutes`;
}

type FormattableToken = Pick<
  TokenInformation,
  "usdPrice" | "symbol" | "address" | "decimals"
>;
export const USD_DISPLAY_DECIMALS = 2;
export function costsToUsd(
  tokens: FormattableToken[],
  costs: Map<string, string | bigint>,
) {
  let totalUsd = 0;
  for (const token of tokens) {
    totalUsd +=
      parseFloat(
        formatUnits(BigInt(costs.get(token.symbol) || 0), token.decimals),
      ) * token.usdPrice;
  }
  return parseUnits(
    totalUsd.toFixed(USD_DISPLAY_DECIMALS),
    USD_DISPLAY_DECIMALS,
  );
}

function formatAmount(value: string | bigint, tokenData: { decimals: number }) {
  return formatUnits(BigInt(value), tokenData.decimals);
}

type FormattableValue = Pick<Token, "symbol" | "decimals" | "address">;
export function formatTokenValue(
  token: FormattableValue,
  cost: string | bigint,
  network: ChainData,
) {
  const amount = formatAmount(cost, token);
  if (network.blockExplorerUrls.length === 0) {
    return `${amount} ${token.symbol}`;
  }
  return `${amount} [${token.symbol}](${network.blockExplorerUrls[0]}address/${token.address})`;
}
