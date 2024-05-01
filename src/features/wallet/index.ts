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
import { toHex } from "viem";
import { Signer } from "ethers";
import { ChainId } from "@biconomy/core-types";
import { hkdf } from "@noble/hashes/hkdf";
import { ScryptOpts, scrypt } from "@noble/hashes/scrypt";
import { keccak_256 } from "@noble/hashes/sha3";
import * as mod from "@noble/curves/abstract/modular";
import { secp256k1 } from "@noble/curves/secp256k1";

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
async function getSigner(uid: string) {
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

export async function getSepoliaSmartAccount(id: string) {
  return await getSmartAccount(
    id,
    11155111 as ChainId,
    "https://rpc.ankr.com/eth_sepolia",
  );
}

export async function getAccountAddress(smartAccount: BiconomySmartAccountV2) {
  return (await smartAccount.getAccountAddress()) as `0x${string}`;
}
