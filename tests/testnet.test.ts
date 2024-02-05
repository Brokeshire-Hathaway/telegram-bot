import dotenv from "dotenv";
import chai from 'chai';
import Moralis from "moralis";
import { EvmChain } from 'moralis/common-evm-utils';
import { sendTransaction, prepareSendToken } from '../src/smartAccount.js';
import { formatEther, parseEther } from 'viem';
import PreciseNumber from '../src/common/tokenMath.js';
import { executeTransaction, sendTokenPreview } from "../src/gpttools.js";

const chainTestnet = EvmChain.SEPOLIA;
const walletAddressWithBalance = "0x4Ce865903d17CaB9e6237b4a44D67c0631166D2B";
const walletAddressNoBalance = "0x2E46AFE76cd64c43293c19253bcd1Afe2262dEfF";

chai.should();

/*describe("Ethereum Sepolia Testnet", () => {
    before(async function () {
        dotenv.config();
        await Moralis.start({
            apiKey: process.env.MORALIS_API_KEY!,
        });
    });
    
    it("should return balances for wallet", async function() {
        const tokenBalancesResponse = await Moralis.EvmApi.token.getWalletTokenBalances({
            address: walletAddressWithBalance,
            chain: chainTestnet,
        });
        const tokenBalances = tokenBalancesResponse.toJSON();
        console.log(`tokenBalances: ${JSON.stringify(tokenBalances)}`);
        tokenBalances.should.have.length.greaterThan(0);
    });

    it("should return no balances for wallet", async function() {
        const tokenBalancesResponse = await Moralis.EvmApi.token.getWalletTokenBalances({
            address: walletAddressNoBalance,
            chain: chainTestnet,
        });
        const tokenBalances = tokenBalancesResponse.toJSON();
        console.log(`tokenBalances: ${JSON.stringify(tokenBalances)}`);
        tokenBalances.should.have.lengthOf(0);
    });
});*/

describe("Biconomy Testnet (Ethereum Sepolia)", function() {
    before(async function () {
        dotenv.config();
    });

    const telegramUserId = "1129320042";
    const recipientAddress = "0x2E46AFE76cd64c43293c19253bcd1Afe2262dEfF";
    const amount = PreciseNumber.from("0.0001");

    /*it("should complete transaction using lower abstraction functions", async function() {
        const userOp = await prepareSendToken(telegramUserId, recipientAddress, amount);
        const receipt = await sendTransaction(telegramUserId, userOp);
        console.log("receipt");
        console.log(receipt);
    });

    it("should complete transaction using GPT tools", async function() {
        this.timeout(35000);

        const preview = await sendTokenPreview({ accountUid: telegramUserId, recipientAddress: recipientAddress, amount: amount.toDecimalString(), standardization: "native" });
        const receipt = await executeTransaction({ transactionUuid: preview.transactionUuid });
        console.log("receipt");
        console.log(receipt);
    });*/
});