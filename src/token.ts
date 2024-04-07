import z from "zod";
import { Network, getViemChain } from "./chain.js";
import { createPublicClient, getContract, http } from "viem";
import { erc20Abi } from "abitype/abis";

// Typescript literals but case insensitive
const literal_case_insensitive = <T extends string = "${1}">(literal: T) =>
  z
    .custom<T>((value) => {
      return typeof value === "string"
        ? value.toLocaleLowerCase() === literal.toLocaleLowerCase()
        : false;
    })
    .transform((v) => v);
export const Token = z.union([
  literal_case_insensitive("uaUSDC"),
  literal_case_insensitive("ETH"),
  literal_case_insensitive("MATIC"),
]);
type Token = z.infer<typeof Token>;

// Map token to their respective network addresses
const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export function tokenToAddress(
  token: Token,
  network: Network,
): `0x${string}` | undefined {
  if (
    (token === "ETH" && network === "sepolia") ||
    (token == "MATIC" && network === "polygon-mumbai")
  )
    return NATIVE_TOKEN;
  if (token === "uaUSDC" && network === "sepolia")
    return "0x254d06f33bDc5b8ee05b2ea472107E300226659A";
  if (token === "uaUSDC" && network === "polygon-mumbai")
    return "0x2c852e740B62308c46DD29B982FBb650D063Bd07";
}

export async function getTokenDecimals(
  address: `0x${string}`,
  network: Network,
): Promise<number> {
  if (!address) return 0;
  if (address === NATIVE_TOKEN) return 18;

  const publicClient = createPublicClient({
    chain: getViemChain(network),
    transport: http(),
  });
  const contract = getContract({
    address: address,
    abi: erc20Abi,
    publicClient: publicClient,
  });
  return await contract.read.decimals();
}

export function isTokeNative(tokenAddress: string) {
  return tokenAddress === NATIVE_TOKEN;
}
