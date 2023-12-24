import { BiconomySmartAccountV2, DEFAULT_ENTRYPOINT_ADDRESS } from "@biconomy/account"
import { ECDSAOwnershipValidationModule, DEFAULT_ECDSA_OWNERSHIP_MODULE, ERC20_ABI } from "@biconomy/modules";
import { ChainId, Transaction, UserOperation } from "@biconomy/core-types"
import { IBundler, Bundler } from '@biconomy/bundler'
import { IPaymaster, BiconomyPaymaster } from '@biconomy/paymaster'
import { WalletClientSigner, LocalAccountSigner } from "@alchemy/aa-core";
import derivePrivateKey from "./derivePrivateKey.js";
import { createWalletClient, encodeFunctionData, formatEther, getContract, http, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { Signer } from "ethers";
import Moralis from "moralis";
import { EvmChain, GetTokenPriceResponseAdapter, GetWalletTokenBalancesJSONResponse } from "moralis/common-evm-utils";
import { UnwrapArray } from "./common/types.js";
import PreciseNumber from "./common/tokenMath.js";
import { BigNumber } from 'ethers';

type TokenStandardization = "erc20" | "native";
type GetWalletTokenBalance = {
    name: string;
    symbol: string;
    decimals: number;
    balance: string;
    possible_spam: boolean;
    standardization: TokenStandardization;
    token_address: string | null;
    logo?: string | undefined;
    thumbnail?: string | undefined;
    verified_collection?: boolean | undefined;
};
export type WalletTokenBalance = GetWalletTokenBalance & { usdBalance: string | null };

const biconomyTestnet = ChainId.GOERLI;

// create instance of bundler
const bundler: IBundler = new Bundler({
    bundlerUrl: `https://bundler.biconomy.io/api/v2/${biconomyTestnet}/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44`,
    chainId: biconomyTestnet,
    entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
})


// create instance of paymaster
/*const paymaster: IPaymaster = new BiconomyPaymaster({
    paymasterUrl: ""
})*/

export async function getSmartAccount(uid: string) {
    const privateKey = derivePrivateKey(uid);
    const signer = LocalAccountSigner.privateKeyToAccountSigner(toHex(privateKey));
    const ownerShipModule = await ECDSAOwnershipValidationModule.create({
        signer: signer as unknown as Signer,
        moduleAddress: DEFAULT_ECDSA_OWNERSHIP_MODULE
        });
    const biconomyAccount = await BiconomySmartAccountV2.create({
        chainId: biconomyTestnet,
        bundler: bundler,
        //paymaster: paymaster,
        entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
        defaultValidationModule: ownerShipModule,
        activeValidationModule: ownerShipModule
    });
    return biconomyAccount;
}

export async function getAccountAddress(uid: string): Promise<`0x${string}`> {
    const smartAccount = await getSmartAccount(uid);
    return await smartAccount.getAccountAddress() as `0x${string}`;
};

// https://docs.moralis.io/supported-chains
const moralisMainnet = EvmChain.ETHEREUM;
const moralisTestnet = EvmChain.GOERLI;
const wrappedNativeToken = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

export async function getAccountBalances(address: `0x${string}`): Promise<WalletTokenBalance[]> {
    const nativeBalanceResponse = await Moralis.EvmApi.balance.getNativeBalance({
        address,
        chain: moralisTestnet,
    });
    const nativeBalance = nativeBalanceResponse.toJSON().balance;
    const formattedNativeBalance: GetWalletTokenBalance = {
        name: "Ethereum",
        symbol: "ETH",
        decimals: 18,
        balance: nativeBalance,
        possible_spam: false,
        standardization: "native",
        token_address: null,
    }
    const usdNativeBalance = await getUsdTokenBalances([formattedNativeBalance]);
    
    const tokenBalancesResponse = await Moralis.EvmApi.token.getWalletTokenBalances({
        address,
        chain: moralisTestnet,
    });
    console.log(`tokenBalancesResponse`);
    console.log(tokenBalancesResponse);
    const tokenBalances: GetWalletTokenBalance[] = tokenBalancesResponse.toJSON().filter(tokenBalance => !tokenBalance.possible_spam).map(tokenBalance => ({ ...tokenBalance, standardization: "erc20" }));
    const usdTokenBalances = await getUsdTokenBalances(tokenBalances);

    return [...usdNativeBalance, ...usdTokenBalances];
};

export async function prepareSendToken(accountUid: string, recipientAddress: `0x${string}`, amount: PreciseNumber, tokenAddress?: `0x${string}`) {
    const smartAccount = await getSmartAccount(accountUid);
    let transaction: Transaction;
    if (tokenAddress) {
        const data = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [recipientAddress, amount.integer]
        });
        transaction = {
            to: tokenAddress,
            data,
        };
    } else {
        transaction = {
            to: recipientAddress,
            data: '0x', // Native token transfer
            value: amount.integer,
        };
    }
    console.log(`transaction`);
    console.log(transaction);
    const userOp = await smartAccount.buildUserOp([transaction]);
    console.log(`userOp`);
    console.log(userOp);
    return userOp;
};

export async function sendTransaction(accountUid: string, userOp: Partial<UserOperation>) {
    const smartAccount = await getSmartAccount(accountUid);
    const userOpResponse = await smartAccount.sendUserOp(userOp);
    console.log("userOpHash", userOpResponse);
    const { receipt } = await userOpResponse.wait(1);
    console.log("txHash", receipt.transactionHash);
    return receipt;
}

async function getUsdTokenBalances(balances: GetWalletTokenBalance[]): Promise<WalletTokenBalance[]> {
    return await Promise.all(balances.map(async (tokenBalance) => {
        const address = tokenBalance.token_address ?? wrappedNativeToken;
        let tokenPriceResponse: GetTokenPriceResponseAdapter;
        try {
            tokenPriceResponse = await Moralis.EvmApi.token.getTokenPrice({
                address,
                chain: moralisMainnet,
            });
        } catch (error) {
            console.warn(`# Error\n${error}`);
            return { ...tokenBalance, usdBalance: null };
        }
        const tokenPrice = String(tokenPriceResponse.toJSON().usdPrice);
        console.log(`tokenPriceResponse`);
        console.log(tokenPriceResponse.toJSON());
        const usdBalance = PreciseNumber.bigMultiply(PreciseNumber.from(tokenBalance.balance, tokenBalance.decimals), PreciseNumber.from(tokenPrice)).toDecimalString();
        return { ...tokenBalance, usdBalance };
    }));
};

export function truncateAddress(address: string): string {
    return `${address.slice(0, 5)}...${address.slice(-3)}`;
}

export function calculateGasFee(userOp: Partial<UserOperation>): PreciseNumber {
    const maxFeePerGas = BigNumber.from(userOp.maxFeePerGas!).toBigInt();

    const verificationGasLimit = BigNumber.from(userOp.verificationGasLimit!).toBigInt();
    const callGasLimit = BigNumber.from(userOp.callGasLimit!).toBigInt();
    const preVerificationGas = BigNumber.from(userOp.preVerificationGas!).toBigInt();

    const estimatedGasUsed = verificationGasLimit + callGasLimit + preVerificationGas;

    const gasFee = maxFeePerGas * estimatedGasUsed;
    return PreciseNumber.from(gasFee);
}