import { ChainData, TokenData } from "@0xsquid/sdk";
import { formatUnits } from "viem";
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

type FormattableFee = Pick<TokenData, "symbol" | "decimals" | "address">;
export function formatFees(
  tokens: FormattableFee[],
  costs: Map<string, string | bigint>,
  network: ChainData,
) {
  if (tokens.length === 0) return "";
  let formattedFees = formatTokenValue(
    tokens[0],
    costs.get(tokens[0].symbol) || "0",
    network,
  );
  for (const token of tokens.slice(1)) {
    formattedFees += ` + ${formatTokenValue(token, costs.get(token.symbol) || "0", network)}`;
  }
  return formattedFees;
}

type FormattableToken = Pick<
  TokenInformation,
  "usdPrice" | "symbol" | "address" | "decimals"
>;
export function formatTotalAmount(
  tokens: FormattableToken[],
  costs: Map<string, string | bigint>,
  network: ChainData,
) {
  const fees = formatFees(tokens, costs, network);
  let totalUsd = 0;
  for (const token of tokens) {
    totalUsd +=
      parseFloat(
        formatUnits(BigInt(costs.get(token.symbol) || 0), token.decimals),
      ) * token.usdPrice;
  }
  return `$${totalUsd.toFixed(2)} (${fees})`;
}

function formatAmount(value: string | bigint, tokenData: { decimals: number }) {
  return formatUnits(BigInt(value), tokenData.decimals);
}

type FormattableValue = Pick<TokenData, "symbol" | "decimals" | "address">;
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
