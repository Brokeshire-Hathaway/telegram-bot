BEGIN TRANSACTION;

ALTER TRIGGER fee_set_updated_at ON fund_code RENAME TO fund_code_updated_at;

CREATE TYPE TransactionType AS ENUM ('send', 'swap');
CREATE TABLE "transaction" (
  id SERIAL PRIMARY KEY,
  identifier uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  "type" TransactionType NOT NULL,
  fees INT NOT NULL,
  total INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE route (
  id SERIAL PRIMARY KEY,
  transaction_id INT NOT NULL REFERENCES transaction(id),
  amount INT NOT NULL,
  token VARCHAR NOT NULL,
  token_address VARCHAR(42) NOT NULL,
  chain VARCHAR NOT NULL,
  chain_id VARCHAR NOT NULL,
  "address" VARCHAR(42) NOT NULL,
  "order" INT NOT NULL
);
CREATE UNIQUE INDEX route_idx ON route (
    transaction_id, "order"
);

INSERT INTO migrations(script_name, schema_version) VALUES ('1-2.sql', 2);

COMMIT;