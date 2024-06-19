import { getPool, sql } from "../../common/database";
import z from "zod";

export async function telemetryChatMessage(
  userId: number,
  message: string,
  isResponse: boolean = false,
) {
  const pool = await getPool();
  return await pool.query(sql.typeAlias("void")`
      INSERT INTO message (user_id, message, is_response)
      VALUES (
        (SELECT id FROM "user" WHERE telegram_id = ${BigInt(userId)}),
        ${message},
        ${isResponse}
      )
  `);
}

const Message = z.object({
  id: z.number(),
  user_id: z.number(),
  message: z.string(),
  is_response: z.boolean(),
  created_at: z.date(),
});
const LastMessage = Message.pick({ message: true, is_response: true });
export type LastMessage = z.infer<typeof LastMessage>;

export async function getUserLastMessages(
  userId: number,
  numberOfMessages: number,
) {
  const pool = await getPool();
  const id = BigInt(userId);
  return await pool.many(
    sql.type(LastMessage)`
      SELECT message, is_response FROM "message"
      INNER JOIN "user" ON "user".id = "message".user_id
      WHERE "user".telegram_id = ${id}
      ORDER BY "message".created_at DESC
      LIMIT ${numberOfMessages}
    `,
  );
}
