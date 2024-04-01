import {
  BiconomySmartAccountV2,
  DEFAULT_ENTRYPOINT_ADDRESS,
} from "@biconomy/account";
import {
  ECDSAOwnershipValidationModule,
  DEFAULT_ECDSA_OWNERSHIP_MODULE,
} from "@biconomy/modules";
import { ChainId } from "@biconomy/core-types";
import { IBundler } from "@biconomy/bundler";
import { LocalAccountSigner } from "@alchemy/aa-core";
import derivePrivateKey from "./derivePrivateKey.js";
import { toHex } from "viem";
import { Signer } from "ethers";
import { createBundler, getRpcUrl } from "../chain.js";

const BICONOMY_TESTNET = 11155111 as ChainId;

// create instance of bundler
export async function getSigner(uid: string) {
  const privateKey = derivePrivateKey(uid);
  return LocalAccountSigner.privateKeyToAccountSigner(
    toHex(privateKey),
  ) as unknown as Signer;
}

export async function getSmartAccount(
  uid: string,
  bundler: IBundler,
  rpcUrl: string,
) {
  const signer = await getSigner(uid);
  const ownershipModule = await ECDSAOwnershipValidationModule.create({
    signer: signer as unknown as Signer,
    moduleAddress: DEFAULT_ECDSA_OWNERSHIP_MODULE,
  });
  const biconomyAccount = await BiconomySmartAccountV2.create({
    chainId: BICONOMY_TESTNET,
    rpcUrl: rpcUrl,
    bundler: bundler,
    entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
    defaultValidationModule: ownershipModule,
    activeValidationModule: ownershipModule,
  });
  return biconomyAccount;
}

export async function getSepoliaSmartAccount(id: string) {
  const bundler = createBundler("sepolia");
  const rpcUrl = getRpcUrl("sepolia");
  return await getSmartAccount(id, bundler, rpcUrl);
}

export async function getAccountAddress(smartAccount: BiconomySmartAccountV2) {
  return (await smartAccount.getAccountAddress()) as `0x${string}`;
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 5)}...${address.slice(-3)}`;
}
