import { createPool } from "slonik";
import { ENVIRONMENT } from "./settings";

const DB_POOL = createPool(
  `postgres://${ENVIRONMENT.DB_USER}:${ENVIRONMENT.DB_PASSWORD}@${ENVIRONMENT.DB_HOST}:${ENVIRONMENT.DB_PORT}/${ENVIRONMENT.DB_NAME}`,
);

export async function getPool() {
  return await DB_POOL;
}
