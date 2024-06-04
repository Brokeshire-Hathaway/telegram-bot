import { MULTICALL_ADDRESS, NATIVE_TOKEN, address } from "../../squidDB/common";
import {
  getAllChains,
  getTokensOfChain,
  getViemClient,
  ChainData,
  TokenInformation,
  getNetworkName,
} from "../../squidDB";
import { getSmartAccountFromChainData } from "./index.js";
import { BiconomySmartAccountV2 } from "@biconomy/account";
import { Hex, PublicClient, erc20Abi, formatUnits, multicall3Abi } from "viem";
import z from "zod";

const BigIntResult = z.union([z.string(), z.number(), z.bigint()]);
const NativeTokenResult = z.object({
  success: z.boolean(),
  returnData: address,
});
type Contract = typeof erc20Abi | typeof multicall3Abi;
async function getAccountBalanceOfTokens(
  account: BiconomySmartAccountV2,
  tokens: Pick<TokenInformation, "symbol" | "address" | "decimals">[],
  client: PublicClient,
): Promise<Map<string, string>> {
  const accountAddress = await account.getAccountAddress();
  const balances = new Map<string, string>();

  // Quick request to verify if chain is working and functional in the account address
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

  // Extract all ERC20 contracts and tokens
  const erc20Tokens = tokens.filter((v) => v.address !== NATIVE_TOKEN);
  const nativeBalanceContract = {
    address: MULTICALL_ADDRESS as Hex,
    abi: multicall3Abi as Contract,
    functionName: "getEthBalance",
    args: [accountAddress],
    reference: nativeToken,
  };
  const tokenContracts = erc20Tokens
    .map((v) => ({
      address: v.address as Hex,
      abi: erc20Abi as Contract,
      functionName: "balanceOf",
      args: [accountAddress],
      reference: v,
    }))
    .concat([nativeBalanceContract]);
  const allBalances = await client.multicall({
    contracts: tokenContracts,
  });
  for (let i = 0; i < tokenContracts.length; i++) {
    const balance = allBalances[i];
    if (balance.status === "failure") continue;

    const isBigInt = await BigIntResult.safeParseAsync(balance.result);
    const token = tokenContracts[i].reference;
    if (isBigInt.success) {
      const result = BigInt(isBigInt.data);
      if (result === BigInt(0)) continue;
      balances.set(token.symbol, formatUnits(result, token.decimals));
      continue;
    }

    const isNativeToken = await NativeTokenResult.safeParseAsync(
      balance.result,
    );
    if (!isNativeToken.success) continue;

    const nativeTokenBalance = BigInt(isNativeToken.data.returnData);
    if (nativeTokenBalance === BigInt(0)) continue;
    balances.set(token.symbol, formatUnits(nativeTokenBalance, token.decimals));
  }

  return balances;
}

async function getAccountBalanceOfChain(
  userId: string,
  network: ChainData,
): Promise<[string, Map<string, string>]> {
  const tokens = getTokensOfChain(network);
  if (tokens.length == 0) return [getNetworkName(network), new Map()];
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
