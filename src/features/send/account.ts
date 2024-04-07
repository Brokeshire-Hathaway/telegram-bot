import { Transaction, UserOperation } from "@biconomy/core-types";
import { UserOpReceipt, UserOpResponse, UserOpStatus } from "@biconomy/bundler";
import {
  SponsorUserOperationDto,
  PaymasterMode,
  IHybridPaymaster,
} from "@biconomy/paymaster";
import { encodeFunctionData } from "viem";
import { BigNumber } from "ethers";
import { erc20Abi } from "abitype/abis";
import { BiconomySmartAccountV2 } from "@biconomy/account";
import PreciseNumber from "../../common/tokenMath.js";
import { getAccountAddress } from "../../account/index.js";

export async function prepareSendToken(
  smartAccount: BiconomySmartAccountV2,
  recipientAddress: `0x${string}`,
  amount: PreciseNumber,
  tokenAddress?: `0x${string}` | null,
) {
  let transaction: Transaction;
  if (tokenAddress) {
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipientAddress, amount.integer],
    });
    transaction = {
      to: tokenAddress,
      data,
    };
  } else {
    transaction = {
      to: recipientAddress,
      data: "0x", // Native token transfer
      value: amount.integer,
    };
  }
  console.log(`transaction`);
  console.log(transaction);
  const userOp = await smartAccount.buildUserOp([transaction]);
  console.log(`userOp`);
  console.log(userOp);
  return userOp;
}

export async function sendTransaction(
  smartAccount: BiconomySmartAccountV2,
  userOp: Partial<UserOperation>,
) {
  // DEBUG
  getAccountAddress(smartAccount).then((address) =>
    console.log(`Address is ${address}`),
  );

  const biconomyPaymaster =
    smartAccount.paymaster as IHybridPaymaster<SponsorUserOperationDto>;
  if (biconomyPaymaster != null) {
    const paymasterServiceData: SponsorUserOperationDto = {
      mode: PaymasterMode.SPONSORED,
      smartAccountInfo: {
        name: "BICONOMY",
        version: "2.0.0",
      },
    };

    try {
      const paymasterAndDataResponse =
        await biconomyPaymaster.getPaymasterAndData(
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
        userOp.verificationGasLimit =
          paymasterAndDataResponse.verificationGasLimit;
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

    userOpStatus = await userOpResponse.waitForTxHash();
    console.log("userOpStatus.transactionHash", userOpStatus.transactionHash);
    console.log(
      "userOpStatus.userOperationReceipt",
      userOpStatus.userOperationReceipt,
    );

    userOpReceipt =
      userOpStatus.userOperationReceipt ?? (await userOpResponse.wait());

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

export function calculateGasFee(userOp: Partial<UserOperation>): PreciseNumber {
  const maxFeePerGas = BigNumber.from(userOp.maxFeePerGas!).toBigInt();

  const verificationGasLimit = BigNumber.from(
    userOp.verificationGasLimit!,
  ).toBigInt();
  const callGasLimit = BigNumber.from(userOp.callGasLimit!).toBigInt();
  const preVerificationGas = BigNumber.from(
    userOp.preVerificationGas!,
  ).toBigInt();

  const estimatedGasUsed =
    verificationGasLimit + callGasLimit + preVerificationGas;

  const gasFee = maxFeePerGas * estimatedGasUsed;
  return PreciseNumber.from(gasFee);
}
