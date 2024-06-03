import { getPool, sql } from "../../common/database";

export async function isUserWhitelisted(userId: number): Promise<boolean> {
  const pool = await getPool();
  return await pool.exists(sql.typeAlias("id")`
    SELECT id FROM user_whitelist
    WHERE user_id = ${BigInt(userId)}
  `);
}

export async function addUserToWaitList(userId: number, username: string) {
  const pool = await getPool();
  return await pool.query(sql.typeAlias("void")`
    INSERT INTO user_waitlist (user_id, username)
    VALUES (${BigInt(userId)}, ${username})
    ON CONFLICT (user_id) DO NOTHING
  `);
}
