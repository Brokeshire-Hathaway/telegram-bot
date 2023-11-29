import { hkdf } from "@noble/hashes/hkdf";
import { ScryptOpts, scrypt } from "@noble/hashes/scrypt";
import { keccak_256 } from "@noble/hashes/sha3";
import * as mod from '@noble/curves/abstract/modular';
import { secp256k1 } from "@noble/curves/secp256k1";

export default function derivePrivateKey(uid: string): Uint8Array {
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