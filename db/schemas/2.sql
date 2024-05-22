BEGIN TRANSACTION;

CREATE OR REPLACE FUNCTION trigger_update_timestamp()
RETURNS trigger AS $$
BEGIN
    new.updated_at = NOW()
    ;
    RETURN new
    ;
END
;
$$ LANGUAGE plpgsql
;

CREATE TABLE fund_code (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  used_by VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER fund_code_updated_at
BEFORE UPDATE ON fund_code FOR each ROW EXECUTE PROCEDURE trigger_update_timestamp();

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

CREATE TABLE migrations (
  schema_version INT UNIQUE NOT NULL,
  script_name VARCHAR,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO migrations(script_name, schema_version) VALUES ('2.sql', 2);

COMMIT;