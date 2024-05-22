import express, { Request, Response } from "express";
import { getAllChains, getViemChain } from "../../common/squidDB.js";
import { getPool, sql } from "../../common/database.js";
import { Route, Transaction } from "./common.js";
import z from "zod";
import { formatUnits } from "viem";
import { USD_DISPLAY_DECIMALS } from "../../common/formatters.js";

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
}).extend({
  routes: z.array(
    Route.pick({
      amount: true,
      token: true,
      address: true,
      chain: true,
    }),
  ),
});
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
          json_build_object(
            'amount', amount,
            'token', token,
            'address', address,
            'chain', chain
          ) as route
        FROM "transaction"
        LEFT JOIN route ON route.transaction_id = "transaction".id
        WHERE "transaction".identifier = ${req.params.uuid}
        ORDER BY route.order
      )
      SELECT
        total,
        fees,
        COALESCE(
          json_agg(route) FILTER (WHERE route_id IS NOT NULL) over (partition by id),
          '[]'
        ) as routes
      FROM transaction_routes
      LIMIT 1
  `);
    return res.json({
      ...transaction,
      fees: formatUnits(transaction.fees, USD_DISPLAY_DECIMALS),
      total: formatUnits(transaction.total, USD_DISPLAY_DECIMALS),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed fetching transaction" });
  }
});

export default router;
