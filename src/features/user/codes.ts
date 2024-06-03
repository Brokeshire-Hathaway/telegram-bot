import z from "zod";
import { getPool, sql } from "../../common/database";

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
