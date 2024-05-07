import { ChainData, TokenData } from "@0xsquid/sdk";
import {
  NATIVE_TOKEN,
  getAllChains,
  getTokensOfChain,
  getViemClient,
} from "../../common/squidDB.js";
import { getAccountAddress, getSmartAccountFromChainData } from "./index.js";
import { BiconomySmartAccountV2 } from "@biconomy/account";
import { Hex, PublicClient, erc20Abi, formatUnits, getContract } from "viem";

const NUMBER_OF_RETRIES = 3;
const MILLISECONDS_BETWEEN_RETRIES = 100;
async function getAccountBalanceOfTokens(
  account: BiconomySmartAccountV2,
  tokens: TokenData[],
  client: PublicClient,
): Promise<Map<string, string>> {
  const accountAddress = await getAccountAddress(account);
  const balances = new Map<string, string>();

  try {
    await client.getBytecode({
      address: accountAddress,
    });
  } catch (error) {
    return balances;
  }

  // Find native balance
  const nativeToken = tokens.find((v) => v.address === NATIVE_TOKEN);
  if (!nativeToken) return balances;
  const nativeBalance = await client.getBalance({ address: accountAddress });
  if (nativeBalance > BigInt(0))
    balances.set(
      nativeToken.symbol,
      formatUnits(nativeBalance, nativeToken.decimals),
    );

  // Extract all contracts and tokens
  const erc20Tokens = tokens.filter((v) => v.address !== NATIVE_TOKEN);
  const erc20TokenContracts = erc20Tokens.map((v) =>
    getContract({
      address: v.address as Hex,
      abi: erc20Abi,
      client,
    }),
  );
  const erc20Balances = await Promise.allSettled(
    erc20TokenContracts.map((v) => v.read.balanceOf([accountAddress])),
  );
  for (let i = 0; i < erc20TokenContracts.length; i++) {
    const token = erc20Tokens[i];
    const erc20Balance = erc20Balances[i];
    if (erc20Balance.status === "fulfilled") {
      if (erc20Balance.value === BigInt(0)) continue;

      balances.set(
        token.symbol,
        formatUnits(erc20Balance.value, token.decimals),
      );
      continue;
    }

    let tries = 0;
    while (tries < NUMBER_OF_RETRIES) {
      try {
        const balance = await erc20TokenContracts[i].read.balanceOf([
          accountAddress,
        ]);
        if (balance === BigInt(0)) break;
        balances.set(token.symbol, formatUnits(balance, token.decimals));
        break;
      } catch {
        tries += 1;
        await new Promise((resolve) =>
          setTimeout(resolve, MILLISECONDS_BETWEEN_RETRIES),
        );
      }
    }
  }

  return balances;
}

async function getAccountBalanceOfChain(
  userId: string,
  network: ChainData,
): Promise<[string, Map<string, string>]> {
  const tokens = getTokensOfChain(network);
  if (tokens.length == 0) return [network.chainName, new Map()];
  const account = await getSmartAccountFromChainData(userId, network);
  return [
    network.networkName,
    await getAccountBalanceOfTokens(account, tokens, getViemClient(network)),
  ];
}

export async function getAllAccountBalances(userId: string) {
  const chains = getAllChains();
  const chainBalances = await Promise.all(
    chains.map((v) => getAccountBalanceOfChain(userId, v)),
  );
  return new Map(chainBalances.filter((v) => v[1].size > 0));
}

export function formatBalances(balances: Map<string, Map<string, string>>) {
  const balancesPerChain = [];
  for (const [chain, balancesOfChain] of balances.entries()) {
    let chainBalance = `*${chain.replace("-", "\\-")}*`;
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
