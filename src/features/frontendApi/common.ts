import z from "zod";
import { getPool, sql } from "../../common/database";
import { address } from "../../common/squidDB";

// All types for the API
export const Route = z.object({
  id: z.number().int(),
  transaction_id: z.number().int(),
  amount: z.bigint().positive(),
  token: z.string(),
  token_address: address,
  chain: z.string(),
  chain_id: z.string(),
  address: z.union([z.literal("OWNER"), address]),
  order: z.number().int(),
});
const RouteCreate = Route.omit({
  id: true,
  transaction_id: true,
  order: true,
});
type RouteCreate = z.infer<typeof RouteCreate>;

const TransactionType = z.union([z.literal("swap"), z.literal("send")]);

export const Transaction = z.object({
  id: z.number().int(),
  identifier: z.string().uuid(),
  type: TransactionType,
  fees: z.bigint().positive(),
  total: z.bigint().positive(),
  created_at: z.date(),
});
const TransactionCreate = Transaction.omit({
  id: true,
  identifier: true,
  created_at: true,
});
type TransactionCreate = z.infer<typeof TransactionCreate>;

// Common function for creating transaction
export async function createTransaction(
  transaction: TransactionCreate,
  routes: RouteCreate[],
) {
  const pool = await getPool();
  return pool.transaction(async (dbTransaction) => {
    const tx = await dbTransaction.one(sql.type(
      Transaction.pick({ identifier: true, id: true }),
    )`
        INSERT INTO transaction ("type", fees, total)
        VALUES (
            ${transaction.type},
            ${transaction.fees},
            ${transaction.total}
        )
        RETURNING id
    `);
    await dbTransaction.query(sql.typeAlias("void")`
        INSERT INTO route (
          amount,
          token,
          "order",
          transaction_id,
          chain,
          address,
          token_address,
          chain_id
        )
        SELECT *
        FROM ${sql.unnest(
          routes.map((v, i) => [
            v.amount,
            v.token,
            i,
            tx.id,
            v.chain,
            v.address,
            v.token_address,
            v.chain_id,
          ]),
          [
            "int8",
            "varchar",
            "int8",
            "int8",
            "varchar",
            "varchar",
            "varchar",
            "varchar",
          ],
        )}
    `);
    return tx.identifier;
  });
}
