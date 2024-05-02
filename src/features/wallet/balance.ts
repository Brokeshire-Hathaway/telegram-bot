import { ChainData } from "@0xsquid/sdk";
import {
  NATIVE_TOKEN,
  getAllChains,
  getTokensOfChain,
  getViemChain,
} from "../../common/squidDB.js";
import { formatUnits, getContract } from "viem";
import { erc20Abi } from "abitype/abis";
import { getAccountAddress, getSmartAccount } from "./index.js";
import { ChainId } from "@biconomy/core-types";

async function getAccountBalanceOfChain(
  address: `0x${string}`,
  network: ChainData,
) {
  const client = getViemChain(network);
  const tokens = getTokensOfChain(network);
  const balances = new Map<string, string>();
  for (const token of tokens) {
    try {
      if (token.address === NATIVE_TOKEN) {
        const balance = await client.getBalance({ address });
        balances.set(token.symbol, formatUnits(balance, token.decimals));
        continue;
      }
      const contract = getContract({
        address: token.address as `0x${string}`,
        abi: erc20Abi,
        publicClient: client,
      });
      const balance = await contract.read.balanceOf([address]);
      if (balance === BigInt(0)) continue;
      balances.set(token.symbol, formatUnits(balance, token.decimals));
    } catch {
      continue;
    }
  }
  return balances;
}

export async function getAllAccountBalances(userId: string) {
  const chains = getAllChains();
  const balancePerChain = new Map<string, Map<string, string>>();
  for (const chain of chains) {
    const account = await getSmartAccount(
      userId,
      chain.chainId as ChainId,
      chain.rpc,
    );
    const address = await getAccountAddress(account);
    balancePerChain.set(
      chain.networkName,
      await getAccountBalanceOfChain(address, chain),
    );
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
