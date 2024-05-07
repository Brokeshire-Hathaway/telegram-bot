import { Chain, createWalletClient, http, toHex } from "viem";
import { hkdf } from "@noble/hashes/hkdf";
import { ScryptOpts, scrypt } from "@noble/hashes/scrypt";
import { keccak_256 } from "@noble/hashes/sha3";
import * as mod from "@noble/curves/abstract/modular";
import { secp256k1 } from "@noble/curves/secp256k1";
import {
  BiconomySmartAccountV2,
  createECDSAOwnershipValidationModule,
  createSmartAccountClient,
} from "@biconomy/account";
import { privateKeyToAccount } from "viem/accounts";
import { IS_TESTNET } from "../../common/settings.js";
import { sepolia, mainnet } from "viem/chains";
import { ChainData } from "@0xsquid/sdk";
import { getViemChain } from "../../common/squidDB.js";

function derivePrivateKey(uid: string): Uint8Array {
  // https://copyprogramming.com/howto/appropriate-scrypt-parameters-when-generating-an-scrypt-hash
  const scryptOptions: ScryptOpts = {
    N: 32768,
    r: 8,
    p: 1,
    dkLen: 32,
  };

  // Using Scrypt because Argon2 is not yet well supported nor audited. It's just now being added to OpenSSL Q4 2023.
  // Scrypt output is biased, so we need to unbias it.
  // https://crypto.stackexchange.com/questions/100341/how-to-safely-and-randomly-iterate-a-key-derived-from-scrypt
  const hash = scrypt(uid, process.env.SECRET_SALT!, scryptOptions);
  // Use HKDF to unbias the hash.
  // https://github.com/paulmillr/noble-curves#creating-private-keys-from-hashes
  const derivedKey = hkdf(keccak_256, hash, undefined, undefined, 48);
  const validPrivateKey = mod.mapHashToField(derivedKey, secp256k1.CURVE.n);
  return validPrivateKey;
}

// create instance of bundler
async function getSigner(uid: string, chain: Chain) {
  const privateKey = derivePrivateKey(uid);
  return createWalletClient({
    account: privateKeyToAccount(toHex(privateKey)),
    chain,
    transport: http(),
  });
}

export async function getSmartAccount(uid: string, chain: Chain) {
  const signer = await getSigner(uid, chain);
  const defaultValidationModule = await createECDSAOwnershipValidationModule({
    signer: signer,
  });
  return createSmartAccountClient({
    signer,
    bundlerUrl: IS_TESTNET
      ? `https://bundler.biconomy.io/api/v2/${chain.id}/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44`
      : `https://bundler.biconomy.io/api/v2/${chain.id}/dewj2189.wh1289hU-7E49-45ic-af80-aVjLXhF0U`,
    defaultValidationModule,
  });
}

export async function getSmartAccountFromChainData(
  uid: string,
  chainData: ChainData,
) {
  return getSmartAccount(uid, getViemChain(chainData));
}

export async function getEthSmartAccount(id: string) {
  if (IS_TESTNET) return await getSmartAccount(id, sepolia);
  return await getSmartAccount(id, mainnet);
}

export async function getAccountAddress(smartAccount: BiconomySmartAccountV2) {
  return smartAccount.getAccountAddress();
}
