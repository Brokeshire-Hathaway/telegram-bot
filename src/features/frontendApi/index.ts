import express, { Request, Response } from "express";
import {
  address,
  getAllChains,
  getTokensDecimals,
  getViemChain,
} from "../../common/squidDB.js";
import { getPool, sql } from "../../common/database.js";
import { Route, Transaction } from "./common.js";
import { Transaction as DataTransaction } from "@biconomy/account";
import z from "zod";
import { formatUnits } from "viem";
import { USD_DISPLAY_DECIMALS } from "../../common/formatters.js";
import getSwapTransactions from "../swap/getTransactions.js";

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
  type: true,
}).extend({
  routes: z.array(
    Route.pick({
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
          "type",
          "route".id as route_id,
          json_build_object(
            'amount', amount,
            'token', token,
            'token_address', token_address,
            'address', address,
            'chain', chain,
            'chain_id', chain_id
          ) as route
        FROM "transaction"
        LEFT JOIN route ON route.transaction_id = "transaction".id
        WHERE "transaction".identifier = ${req.params.uuid}
        ORDER BY route.order
      )
      SELECT
        total,
        fees,
        type,
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
        amount: formatUnits(
          v.amount,
          getTokensDecimals(v.chain_id, v.token_address),
        ),
        token: v.token,
        address: v.address,
        chain: v.chain,
      })),
      transaction: transactionInformation,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed fetching transaction" });
  }
});

type ConsolidatedTransaction = {
  transactions: DataTransaction[];
  maxFeePerGas?: string;
  callGasLimit?: string;
  maxPriorityFeePerGas?: string;
};
async function getTransactionsAndGasFee(
  transactionPreview: TransactionPreview,
  accountAddress: `0x${string}`,
): Promise<ConsolidatedTransaction> {
  switch (transactionPreview.type) {
    case "swap":
      if (transactionPreview.routes.length < 2)
        throw new Error("Inconsistent route, try again later.");
      return await getSwapTransactions(
        accountAddress,
        transactionPreview.routes[0].chain_id,
        transactionPreview.routes[0].token_address,
        transactionPreview.routes[1].chain_id,
        transactionPreview.routes[1].token_address,
        transactionPreview.routes[0].amount,
      );

    case "send":
      throw new Error("Route not implemented");
  }
}
export default router;
