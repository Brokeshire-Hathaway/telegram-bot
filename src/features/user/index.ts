import { getPool, sql } from "../../common/database";
import z from "zod";

const User = z.object({
  id: z.number(),
  user_id: z.bigint(),
  username: z.string(),
  is_admin: z.boolean(),
  access_code_id: z.number(),
});

export async function isUserWhitelisted(userId: number): Promise<boolean> {
  const pool = await getPool();
  return await pool.exists(sql.typeAlias("id")`
    SELECT id FROM "user"
    WHERE telegram_id = ${BigInt(userId)}
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

export async function isUserAdmin(userId: number) {
  const pool = await getPool();
  return await pool.exists(sql.type(User.pick({ is_admin: true }))`
    SELECT is_admin FROM "user"
    WHERE telegram_id = ${BigInt(userId)} and is_admin
  `);
}

export async function whiteListUser(userId: number, username: string) {
  const pool = await getPool();
  const id = BigInt(userId);
  return await pool.transaction(async (transaction) => {
    await transaction.query(sql.typeAlias("void")`
        DELETE FROM user_waitlist
        WHERE user_id = ${id};
    `);
    await transaction.query(sql.typeAlias("void")`
        INSERT INTO "user" (telegram_id, username, access_code_id)
        VALUES (${id}, ${username}, null)
    `);
  });
}
