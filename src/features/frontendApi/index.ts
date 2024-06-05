import express, { Request, Response } from "express";
import { address } from "../../squidDB/common.js";
import {
  getAllChains,
  getTokensDecimals,
  getViemChain,
  Transaction as DataTransaction,
} from "../../squidDB";
import { getPool, sql } from "../../common/database.js";
import { Route, Transaction } from "./common.js";
import z from "zod";
import { formatUnits } from "viem";
import { USD_DISPLAY_DECIMALS } from "../../common/formatters.js";
import getSwapTransactions from "../swap/getTransaction.js";
import getSendTransactions from "../send/getTransactions.js";
import { Code } from "../user/codes.js";
import { ENVIRONMENT } from "../../common/settings.js";

// Create the router
const router = express.Router();

// Get all necessary chains
router.get("/chains", async (req: Request, res: Response) => {
  return res.json(getAllChains().map((v) => getViemChain(v)));
});

// Get unconsolidated route preview
const TransactionPreview = Transaction.pick({
  total: true,
  fees: true,
  call_gas_limit: true,
  max_fee_per_gas: true,
  max_priority_fee_per_gas: true,
}).extend({
  routes: z.array(
    Route.pick({
      type: true,
      amount: true,
      token: true,
      address: true,
      chain: true,
      chain_id: true,
      token_address: true,
    }),
  ),
});
type TransactionPreview = z.infer<typeof TransactionPreview>;
router.get("/transaction/:uuid", async (req: Request, res: Response) => {
  const pool = await getPool();
  try {
    const transaction = await pool.one(sql.type(TransactionPreview)`
      WITH transaction_routes AS (
        SELECT
          "transaction".id,
          total,
          fees,
          "route".id as route_id,
          call_gas_limit,
          max_fee_per_gas,
          max_priority_fee_per_gas,
          json_build_object(
            'amount', amount,
            'token', token,
            'token_address', token_address,
            'address', address,
            'chain', chain,
            'chain_id', chain_id,
            'type', "type"
          ) as route
        FROM "transaction"
        LEFT JOIN route ON route.transaction_id = "transaction".id
        WHERE "transaction".identifier = ${req.params.uuid}
        ORDER BY route.order
      )
      SELECT
        total,
        fees,
        call_gas_limit,
        max_fee_per_gas,
        max_priority_fee_per_gas,
        COALESCE(
          json_agg(route) FILTER (WHERE route_id IS NOT NULL) over (partition by id),
          '[]'
        ) as routes
      FROM transaction_routes
      LIMIT 1
  `);
    let transactionInformation = undefined as
      | ConsolidatedTransaction
      | undefined;

    // Consolidate transaction with proper address
    const requestAddress = await address.safeParseAsync(req.query.address);
    if (requestAddress.success) {
      transactionInformation = await getTransactionsAndGasFee(
        transaction,
        requestAddress.data,
      );
    }

    return res.json({
      fees: formatUnits(transaction.fees, USD_DISPLAY_DECIMALS),
      total: formatUnits(transaction.total, USD_DISPLAY_DECIMALS),
      routes: transaction.routes.map((v) => ({
        amount: v.amount.toString(),
        decimals: getTokensDecimals(v.chain_id, v.token_address),
        type: v.type,
        token: v.token,
        token_address: v.token_address,
        address: v.address,
        chain: v.chain,
        chain_id: v.chain_id,
      })),
      transaction: transactionInformation,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed fetching transaction" });
  }
});

type ConsolidatedTransaction = {
  transaction: DataTransaction;
  max_fee_per_gas?: string;
  call_gas_limit?: string;
  max_priority_fee_per_gas?: string;
};
async function getTransactionsAndGasFee(
  transactionPreview: TransactionPreview,
  accountAddress: `0x${string}`,
): Promise<ConsolidatedTransaction> {
  if (transactionPreview.routes.length < 2)
    throw new Error("Inconsistent route, try again later.");
  let transaction;
  switch (transactionPreview.routes[0].type) {
    case "swap":
      transaction = await getSwapTransactions(
        accountAddress,
        transactionPreview.routes[0].chain_id,
        transactionPreview.routes[0].token_address,
        transactionPreview.routes[1].chain_id,
        transactionPreview.routes[1].token_address,
        transactionPreview.routes[0].amount,
      );
      break;

    case "send": {
      const recipientAddress = await address.safeParseAsync(
        transactionPreview.routes[1].address,
      );
      if (!recipientAddress.success)
        throw new Error("Address belongs to owner");
      transaction = getSendTransactions(
        transactionPreview.routes[0].token_address,
        recipientAddress.data,
        transactionPreview.routes[0].amount,
      );
      break;
    }
  }
  if (!transaction) throw new Error("Transactions not found");
  return {
    transaction,
    call_gas_limit: transactionPreview.call_gas_limit?.toString(),
    max_fee_per_gas: transactionPreview.max_fee_per_gas?.toString(),
    max_priority_fee_per_gas:
      transactionPreview.max_priority_fee_per_gas?.toString(),
  };
}

router.get("/code/:uuid", async (req: Request, res: Response) => {
  const pool = await getPool();
  try {
    const accessCode = await pool.one(sql.type(
      Code.pick({ created_by: true, code: true }),
    )`
      SELECT code, created_by FROM access_code
      WHERE identifier = ${req.params.uuid} and remaining_uses > 0
      `);
    return res.json({
      ...accessCode,
      chat_url: `https://t.me/${ENVIRONMENT.TELEGRAM_BOT_USERNAME}`,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed fetching access code" });
  }
});
export default router;
