import z from "zod";
import { getPool, sql } from "../../common/database";
import { isUserWhitelisted } from ".";

const Code = z.object({
  id: z.number(),
  identifier: z.string(),
  code: z.string(),
  remaining_uses: z.number().int(),
  created_by: z.string(),
});

export async function createReferralCode(
  numberOfUses: number,
  username: string,
) {
  const pool = await getPool();
  return await pool.one(sql.type(Code.pick({ identifier: true, code: true }))`
        INSERT INTO access_code (remaining_uses, created_by)
        VALUES (${numberOfUses}, ${username})
        RETURNING identifier, code
    `);
}

export async function redeemCode(
  code: string,
  userId: number,
  username: string,
): Promise<"redeemed" | "failed"> {
  const pool = await getPool();

  if (await isUserWhitelisted(userId)) return "failed";

  const id = BigInt(userId);
  return await pool.transaction(async (transaction) => {
    const accessCode = await transaction.maybeOne(sql.typeAlias("id")`
        UPDATE access_code
        SET remaining_uses = GREATEST(remaining_uses - 1, 0)
        WHERE code = ${code} and remaining_uses > 0
        RETURNING id
    `);
    if (!accessCode) return "failed";
    await transaction.query(sql.typeAlias("void")`
        DELETE FROM user_waitlist
        WHERE user_id = ${id};
    `);
    await transaction.query(sql.typeAlias("void")`
        INSERT INTO user_whitelist (user_id, username, access_code_id)
        VALUES (${id}, ${username}, ${accessCode.id})
    `);
    return "redeemed";
  });
}
