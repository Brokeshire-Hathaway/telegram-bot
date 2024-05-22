import z from "zod";
import { getPool, sql } from "../../common/database";
import { address } from "../../common/squidDB";

// All types for the API
export const Route = z.object({
  id: z.number().int(),
  transaction_id: z.number().int(),
  amount: z.bigint().positive(),
  token: z.string(),
  chain: z.string(),
  address: z.union([z.literal("OWNER"), address]),
  order: z.number().int(),
});
const RouteCreate = Route.pick({
  amount: true,
  token: true,
  chain: true,
  address: true,
});
type RouteCreate = z.infer<typeof RouteCreate>;

const TransactionType = z.union([z.literal("swap"), z.literal("send")]);

export const Transaction = z.object({
  id: z.number().int(),
  identifier: z.string().uuid(),
  type: TransactionType,
  information: z.record(z.string(), z.union([z.string(), z.number()])),
  fees: z.bigint().positive(),
  total: z.bigint().positive(),
  created_at: z.date(),
});
const TransactionCreate = Transaction.pick({
  type: true,
  information: true,
  fees: true,
  total: true,
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
        INSERT INTO transaction ("type", information, fees, total)
        VALUES (
            ${transaction.type},
            ${sql.jsonb(transaction.information)},
            ${transaction.fees},
            ${transaction.total}
        )
        RETURNING id
    `);
    await dbTransaction.query(sql.typeAlias("void")`
        INSERT INTO route (amount, token, "order", transaction_id, chain, address)
        SELECT *
        FROM ${sql.unnest(
          routes.map((v, i) => [
            v.amount,
            v.token,
            i,
            tx.id,
            v.chain,
            v.address,
          ]),
          ["int8", "varchar", "int8", "int8", "varchar", "varchar"],
        )}
    `);
    return tx.identifier;
  });
}
