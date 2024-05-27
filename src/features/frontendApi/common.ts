import z from "zod";
import { getPool, sql } from "../../common/database";
import { address } from "../../common/squidDB";
import { ENVIRONMENT } from "../../common/settings";

// All types for the API
const TransactionType = z.union([z.literal("swap"), z.literal("send")]);

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
  type: TransactionType.nullish(),
});
const RouteCreate = Route.omit({
  id: true,
  transaction_id: true,
  order: true,
});
type RouteCreate = z.infer<typeof RouteCreate>;

export const Transaction = z.object({
  id: z.number().int(),
  identifier: z.string().uuid(),
  fees: z.bigint().positive(),
  total: z.bigint().positive(),
  call_gas_limit: z.bigint().nullish(),
  max_fee_per_gas: z.bigint().nullish(),
  max_priority_fee_per_gas: z.bigint().nullish(),
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
        INSERT INTO transaction (
          fees,
          total,
          call_gas_limit,
          max_fee_per_gas,
          max_priority_fee_per_gas
        )
        VALUES (
            ${transaction.fees},
            ${transaction.total},
            ${transaction.call_gas_limit || null},
            ${transaction.max_fee_per_gas || null},
            ${transaction.max_priority_fee_per_gas || null}
        )
        RETURNING id, identifier
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
          chain_id,
          "type"
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
            v.type || null,
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
            "transactiontype",
          ],
        )}
    `);
    return tx.identifier;
  });
}

export function getUrl(identifier: string) {
  return `${ENVIRONMENT.FRONTEND_URL}/tx/${identifier}`;
}
