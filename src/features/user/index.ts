import { getPool, sql } from "../../common/database";

export async function isUserWhitelisted(userId: number): Promise<boolean> {
  const pool = await getPool();
  return await pool.exists(sql.typeAlias("id")`
    SELECT id FROM user_whitelist
    WHERE user_id = ${BigInt(userId)}
  `);
}
