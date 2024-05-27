import { createPool, createSqlTag } from "slonik";
import { ENVIRONMENT } from "./settings";
import z from "zod";

const PASSWORD = encodeURIComponent(ENVIRONMENT.DB_PASSWORD);
const DB_POOL = createPool(
  `postgres://${ENVIRONMENT.DB_USER}:${PASSWORD}@${ENVIRONMENT.DB_HOST}:${ENVIRONMENT.DB_PORT}/${ENVIRONMENT.DB_NAME}`,
);

export async function getPool() {
  return await DB_POOL;
}

export const sql = createSqlTag({
  typeAliases: {
    id: z.object({
      id: z.number(),
    }),
    void: z.object({}).strict(),
  },
});
