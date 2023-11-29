
import { BiconomySmartAccountV2, DEFAULT_ENTRYPOINT_ADDRESS } from "@biconomy/account"
import { ECDSAOwnershipValidationModule, DEFAULT_ECDSA_OWNERSHIP_MODULE } from "@biconomy/modules";
import { ChainId } from "@biconomy/core-types"
import { IBundler, Bundler } from '@biconomy/bundler'
import { IPaymaster, BiconomyPaymaster } from '@biconomy/paymaster'
import { WalletClientSigner, LocalAccountSigner } from "@alchemy/aa-core";
import derivePrivateKey from "./derivePrivateKey.js";
import { createWalletClient, http, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { Signer } from "ethers";

// create instance of bundler
const bundler: IBundler = new Bundler({
//https://dashboard.biconomy.io/ get bundler urls from your dashboard
bundlerUrl: "",    
chainId: ChainId.POLYGON_MUMBAI,
entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
})


// create instance of paymaster
const paymaster: IPaymaster = new BiconomyPaymaster({
//https://dashboard.biconomy.io/ get paymaster urls from your dashboard
paymasterUrl: ""
})

export async function getAccountAddress(uid: string): Promise<string> {
    const privateKey = derivePrivateKey(uid);
    /*const account = privateKeyToAccount(toHex(privateKey));
    const client = createWalletClient({ 
        account,
        transport: http()
      });
    const signer = new WalletClientSigner(client, "json-rpc");*/
    const signer = LocalAccountSigner.privateKeyToAccountSigner(toHex(privateKey));
    const ownerShipModule = await ECDSAOwnershipValidationModule.create({
        signer: signer as unknown as Signer,
        moduleAddress: DEFAULT_ECDSA_OWNERSHIP_MODULE
        });
    const biconomyAccount = await BiconomySmartAccountV2.create({
        chainId: ChainId.POLYGON_MUMBAI,
        bundler: bundler,
        paymaster: paymaster,
        entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
        defaultValidationModule: ownerShipModule,
        activeValidationModule: ownerShipModule
    });
    const address = await biconomyAccount.getAccountAddress();
    return address;
};
