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

CREATE TABLE access_code (
  id SERIAL PRIMARY KEY,
  identifier uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  code VARCHAR(32) UNIQUE NOT NULL DEFAULT md5(random()::text),
  remaining_uses INT NOT NULL,
  created_by VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER access_code_updated_at
BEFORE UPDATE ON access_code FOR each ROW EXECUTE PROCEDURE trigger_update_timestamp();
CREATE UNIQUE INDEX access_code_idx ON access_code (
    code, remaining_uses
);

CREATE TABLE user_whitelist (
  id SERIAL PRIMARY KEY,
  access_code_id INT REFERENCES access_code(id),
  user_id INT UNIQUE NOT NULL,
  username VARCHAR NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE migrations (
  schema_version INT UNIQUE NOT NULL,
  script_name VARCHAR,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO migrations(script_name, schema_version) VALUES ('3.sql', 3);

COMMIT;