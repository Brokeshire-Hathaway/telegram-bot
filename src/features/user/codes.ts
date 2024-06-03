import z from "zod";
import { getPool, sql } from "../../common/database";
import { isUserWhitelisted } from ".";
import { CommonQueryMethods } from "slonik";
import { ENVIRONMENT } from "../../common/settings";

const Code = z.object({
  id: z.number(),
  identifier: z.string(),
  code: z.string(),
  remaining_uses: z.number().int(),
  created_by: z.string(),
});

export async function createReferralCodes(
  numberOfUses: number,
  username: string,
  connection: CommonQueryMethods,
  numberOfCodes = 1,
) {
  const codes = new Array(numberOfCodes).fill([numberOfUses, username]);
  return await connection.any(sql.type(
    Code.pick({ identifier: true, code: true }),
  )`
        INSERT INTO access_code (remaining_uses, created_by)
        SELECT *
        FROM ${sql.unnest(codes, ["int8", "varchar"])}
        RETURNING identifier, code
    `);
}

export async function redeemCode(
  code: string,
  userId: number,
  username: string,
) {
  const pool = await getPool();

  if (await isUserWhitelisted(userId))
    throw new Error("User is already whitelisted.");

  const id = BigInt(userId);
  return await pool.transaction(async (transaction) => {
    const accessCode = await transaction.maybeOne(sql.typeAlias("id")`
        UPDATE access_code
        SET remaining_uses = GREATEST(remaining_uses - 1, 0)
        WHERE code = ${code} and remaining_uses > 0
        RETURNING id
    `);
    if (!accessCode) throw new Error("Code does not exist.");
    await transaction.query(sql.typeAlias("void")`
        DELETE FROM user_waitlist
        WHERE user_id = ${id};
    `);
    await transaction.query(sql.typeAlias("void")`
        INSERT INTO user_whitelist (user_id, username, access_code_id)
        VALUES (${id}, ${username}, ${accessCode.id})
    `);
    return await createReferralCodes(
      1,
      username,
      transaction,
      ENVIRONMENT.NUMBER_OF_CODES_PER_USER,
    );
  });
}
