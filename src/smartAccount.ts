import { BiconomySmartAccountV2, DEFAULT_ENTRYPOINT_ADDRESS } from "@biconomy/account"
import { ECDSAOwnershipValidationModule, DEFAULT_ECDSA_OWNERSHIP_MODULE, ERC20_ABI } from "@biconomy/modules";
import { ChainId, Transaction, UserOperation } from "@biconomy/core-types"
import { IBundler, Bundler, UserOpReceipt, UserOpResponse, UserOpStatus } from '@biconomy/bundler'
import { IPaymaster, BiconomyPaymaster, SponsorUserOperationDto, PaymasterMode, IHybridPaymaster } from '@biconomy/paymaster'
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

const biconomyTestnet = 11155111 as ChainId;

// create instance of bundler
const bundler: IBundler = new Bundler({
    //bundlerUrl: `https://bundler.biconomy.io/api/v2/${biconomyTestnet}/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44`, // Doesn't work with Sepolia
    bundlerUrl: "https://bundler.biconomy.io/api/v2/11155111/BBagqibhs.HI7fopYh-iJkl-45ic-afU9-6877f7gaia78Cv",
    chainId: biconomyTestnet,
    entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
})


// create instance of paymaster
const paymaster: IPaymaster = new BiconomyPaymaster({
    paymasterUrl: `https://paymaster.biconomy.io/api/v1/${biconomyTestnet}/1ERuu9OSC.e70f5d58-c73e-4e38-a27e-e3a779dc6171`
})

export async function getSmartAccount(uid: string) {
    const privateKey = derivePrivateKey(uid);
    const signer = LocalAccountSigner.privateKeyToAccountSigner(toHex(privateKey));
    const ownerShipModule = await ECDSAOwnershipValidationModule.create({
        signer: signer as unknown as Signer,
        moduleAddress: DEFAULT_ECDSA_OWNERSHIP_MODULE
        });
    const biconomyAccount = await BiconomySmartAccountV2.create({
        chainId: biconomyTestnet,
        rpcUrl: "https://rpc.sepolia.org",
        bundler: bundler,
        paymaster: paymaster,
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
const moralisTestnet = EvmChain.SEPOLIA;
const wrappedNativeToken = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";

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

    const biconomyPaymaster = smartAccount.paymaster as IHybridPaymaster<SponsorUserOperationDto>;
    if (biconomyPaymaster != null) {
        let paymasterServiceData: SponsorUserOperationDto = {
            mode: PaymasterMode.SPONSORED,
            smartAccountInfo: {
                name: 'BICONOMY',
                version: '2.0.0'
            },
        };

        try {
            const paymasterAndDataResponse = await biconomyPaymaster.getPaymasterAndData(
                userOp,
                paymasterServiceData,
            );
            userOp.paymasterAndData = paymasterAndDataResponse.paymasterAndData;

            if (
                paymasterAndDataResponse.callGasLimit &&
                paymasterAndDataResponse.verificationGasLimit &&
                paymasterAndDataResponse.preVerificationGas
            ) {
                // Returned gas limits must be replaced in your op as you update paymasterAndData.
                // Because these are the limits paymaster service signed on to generate paymasterAndData
                // If you receive AA34 error check here..

                userOp.callGasLimit = paymasterAndDataResponse.callGasLimit;
                userOp.verificationGasLimit = paymasterAndDataResponse.verificationGasLimit;
                userOp.preVerificationGas = paymasterAndDataResponse.preVerificationGas;
            }
        } catch (e) {
            console.warn("=== biconomyPaymaster.getPaymasterAndData() ===", e);
        }
    }

    console.log(`smartAccount.bundler`);
    console.log(smartAccount.bundler);

    let userOpResponse: UserOpResponse;
    try {
        userOpResponse = await smartAccount.sendUserOp(userOp);
    } catch (error) {
        console.error(`=== Error: smartAccount.sendUserOp(userOp) ===`);
        console.error(error);
        throw error;
    }
    console.log("userOpHash", userOpResponse);

    let userOpStatus: UserOpStatus;
    let userOpReceipt: UserOpReceipt;
    try {
        console.log(`userOpResponse.userOpHash`);
        console.log(userOpResponse.userOpHash);
        console.log("bundler.getUserOpReceipt");
        console.log(bundler.getUserOpReceipt);

        userOpStatus = await userOpResponse.waitForTxHash();
        console.log("userOpStatus.transactionHash", userOpStatus.transactionHash);
        console.log("userOpStatus.userOperationReceipt", userOpStatus.userOperationReceipt);

        userOpReceipt = userOpStatus.userOperationReceipt ?? await userOpResponse.wait();

        console.log(`userOpReceipt`);
        console.log(userOpReceipt);

        if (!userOpReceipt.success) {
            throw new Error(`Transaction failed: ${userOpReceipt.reason}`);
        }
    } catch (error) {
        console.error(`=== Error ===`);
        console.error(error);
        throw error;
    }
    
    console.log("txHash", userOpReceipt.receipt.transactionHash);
    return userOpReceipt;
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