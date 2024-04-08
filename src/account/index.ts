import {
  BiconomySmartAccountV2,
  DEFAULT_ENTRYPOINT_ADDRESS,
} from "@biconomy/account";
import {
  ECDSAOwnershipValidationModule,
  DEFAULT_ECDSA_OWNERSHIP_MODULE,
} from "@biconomy/modules";
import { Bundler } from "@biconomy/bundler";
import { LocalAccountSigner } from "@alchemy/aa-core";
import derivePrivateKey from "./derivePrivateKey.js";
import { toHex } from "viem";
import { Signer } from "ethers";
import { Network, getChainId, getRpcUrl } from "../chain.js";
import { ChainId } from "@biconomy/core-types";

// create instance of bundler
export async function getSigner(uid: string) {
  const privateKey = derivePrivateKey(uid);
  return LocalAccountSigner.privateKeyToAccountSigner(toHex(privateKey));
}

export async function getSmartAccount(
  uid: string,
  chainId: ChainId,
  rpcUrl: string,
) {
  const userOpReceiptMaxDurationIntervals = {
    chainId: 60000,
  };
  const bundler = new Bundler({
    bundlerUrl: `https://bundler.biconomy.io/api/v2/${chainId}/BBagqibhs.HI7fopYh-iJkl-45ic-afU9-6877f7gaia78Cv`,
    chainId: chainId,
    entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    userOpReceiptMaxDurationIntervals: userOpReceiptMaxDurationIntervals,
  });
  const signer = await getSigner(uid);
  const ownershipModule = await ECDSAOwnershipValidationModule.create({
    signer: signer as unknown as Signer,
    moduleAddress: DEFAULT_ECDSA_OWNERSHIP_MODULE,
  });
  const biconomyAccount = await BiconomySmartAccountV2.create({
    chainId: chainId,
    rpcUrl: rpcUrl,
    bundler: bundler,
    entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
    defaultValidationModule: ownershipModule,
    activeValidationModule: ownershipModule,
  });
  return biconomyAccount;
}

export async function getSmartAccountFromNetwork(
  uid: string,
  network: Network,
) {
  return await getSmartAccount(uid, getChainId(network), getRpcUrl(network));
}

export async function getSepoliaSmartAccount(id: string) {
  return await getSmartAccountFromNetwork(id, "sepolia");
}

export async function getAccountAddress(smartAccount: BiconomySmartAccountV2) {
  return (await smartAccount.getAccountAddress()) as `0x${string}`;
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 5)}...${address.slice(-3)}`;
}
