import { ChainData } from "@0xsquid/sdk";
import {
  NATIVE_TOKEN,
  getAllChains,
  getTokensOfChain,
} from "../../common/squidDB.js";
import { getSmartAccountFromChainData } from "./index.js";

async function getAccountBalanceOfChain(userId: string, network: ChainData) {
  const tokens = getTokensOfChain(network);
  const tokenAddressToSymbol = new Map<string, string>();
  if (tokens.length == 0) return tokenAddressToSymbol;
  const tokenAddresses = tokens
    .map((v) => {
      tokenAddressToSymbol.set(v.address, v.symbol);
      return v.address as `0x${string}`;
    })
    .filter((v) => v != NATIVE_TOKEN);
  const balances = new Map<string, string>();
  const account = await getSmartAccountFromChainData(userId, network);
  let balanceOfAccount;
  try {
    balanceOfAccount = await account.getBalances(tokenAddresses);
  } catch (error) {
    return balances;
  }
  for (const balance of balanceOfAccount) {
    if (balance.amount === BigInt(0)) continue;
    const symbol = tokenAddressToSymbol.get(balance.address);
    if (!symbol) continue;
    balances.set(symbol, balance.formattedAmount);
  }
  return balances;
}

export async function getAllAccountBalances(userId: string) {
  const chains = getAllChains();
  const balancePerChain = new Map<string, Map<string, string>>();
  for (const chain of chains) {
    const chainBalance = await getAccountBalanceOfChain(userId, chain);
    if (chainBalance.size === 0) continue;
    balancePerChain.set(chain.networkName, chainBalance);
  }
  return balancePerChain;
}

export function formatBalances(balances: Map<string, Map<string, string>>) {
  const balancesPerChain = [];
  for (const [chain, balancesOfChain] of balances.entries()) {
    let chainBalance = `*${chain}*`;
    let maxSizeBalance = 0;
    for (const balance of balancesOfChain.values()) {
      if (balance.length > maxSizeBalance) maxSizeBalance = balance.length;
    }

    for (const [token, balance] of balancesOfChain.entries()) {
      chainBalance += `\n└ \`${balance.padEnd(maxSizeBalance)}\`  _${token}_`;
    }
    balancesPerChain.push(chainBalance);
  }
  return balancesPerChain.join("\n\n");
}
