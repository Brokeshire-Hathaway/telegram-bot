import z from "zod";
// All types for the API
export const Route = z.object({
  id: z.number().int(),
  transaction_id: z.number().int(),
  amount: z.number().int(),
  token: z.string(),
  order: z.number().int(),
});
const TransactionType = z.union([z.literal("swap"), z.literal("send")]);

export const Transaction = z.object({
  id: z.number().int(),
  identifier: z.string().uuid(),
  type: TransactionType,
  information: z.record(z.string(), z.union([z.string(), z.number()])),
  fees: z.number().int(),
  total: z.number().int(),
  created_at: z.date(),
});
