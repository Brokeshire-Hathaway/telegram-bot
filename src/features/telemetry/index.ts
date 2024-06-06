import { getPool, sql } from "../../common/database";

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
