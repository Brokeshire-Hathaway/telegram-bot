import { FeeCost, GasCost, TokenData } from "@0xsquid/sdk";
import { formatUnits } from "viem";

export function formatTime(timeInSeconds: number) {
  if (timeInSeconds <= 1) {
    return `< 1 second`;
  }
  if (timeInSeconds < 60) {
    return `${timeInSeconds} seconds`;
  }
  return `${(timeInSeconds / 60).toFixed(1)} minutes`;
}

function addCost(
  costs: Map<string, [bigint, number]>,
  txCosts: { token: { name: string; decimals: number }; amount: string }[],
) {
  for (const cost of txCosts) {
    let tokenCostInfo = costs.get(cost.token.name);
    if (!tokenCostInfo) tokenCostInfo = [BigInt(0), cost.token.decimals];
    costs.set(cost.token.name, [
      tokenCostInfo[0] + BigInt(cost.amount),
      tokenCostInfo[1],
    ]);
  }
}

export function totalFeeCosts(feeCosts: FeeCost[], gasCosts: GasCost[]) {
  const costs = new Map<string, [bigint, number]>();
  addCost(costs, feeCosts);
  addCost(costs, gasCosts);
  const costsFormatted = {} as Record<string, string>;
  costs.forEach((v, k) => (costsFormatted[k] = formatUnits(...v)));
  return costsFormatted;
}

export function formatAmount(value: string, tokenData: TokenData) {
  return `${formatUnits(BigInt(value), tokenData.decimals)} ${tokenData.name}`;
}
