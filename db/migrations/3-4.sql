BEGIN TRANSACTION;

ALTER TABLE "user_whitelist"
RENAME TO "user";

ALTER TABLE "user"
RENAME COLUMN user_id to telegram_id;

DELETE FROM "route";
DELETE FROM "transaction";
ALTER TABLE "transaction"
ADD has_executed BOOLEAN NOT NULL DEFAULT false,
ADD created_by INT NOT NULL REFERENCES "user"(id)
;

CREATE TABLE "user_address" (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES "user"(id),
  "address" VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE message (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES "user"(id),
  "message" VARCHAR NOT NULL,
  is_response BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO migrations(script_name, schema_version) VALUES ('3-4.sql', 4);

COMMIT;