BEGIN TRANSACTION;

ALTER TRIGGER fee_set_updated_at ON fund_code RENAME TO fund_code_updated_at;

CREATE TABLE "transaction" (
  id SERIAL PRIMARY KEY,
  identifier uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  fees BIGINT NOT NULL,
  total BIGINT NOT NULL,
  call_gas_limit BIGINT,
  max_fee_per_gas BIGINT,
  max_priority_fee_per_gas BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE TransactionType AS ENUM ('send', 'swap');
CREATE TABLE route (
  id SERIAL PRIMARY KEY,
  transaction_id INT NOT NULL REFERENCES transaction(id),
  amount BIGINT NOT NULL,
  "type" TransactionType,
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