BEGIN TRANSACTION;

CREATE TABLE access_code (
  id SERIAL PRIMARY KEY,
  identifier uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  code VARCHAR(32) UNIQUE NOT NULL DEFAULT substring(md5(random()::text), 1, 9),
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
  user_id BIGINT UNIQUE NOT NULL,
  username VARCHAR NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_waitlist (
  id SERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL,
  username VARCHAR NOT NULL,
  asked_to_join_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO migrations(script_name, schema_version) VALUES ('2-3.sql', 3);

COMMIT;