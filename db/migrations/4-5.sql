BEGIN TRANSACTION;

CREATE MATERIALIZED VIEW mv_ember_traction
AS
    SELECT u1.*, u2.*, u3.*, u4.* FROM (

    SELECT COUNT(*) as number_of_code_claims FROM "user"
    WHERE access_code_id = 7

    ) u1, (

        SELECT COUNT(*) as number_of_first_interactions FROM "message"
        INNER JOIN "user" ON "user".id = "message".user_id
        WHERE access_code_id = 7 AND EXTRACT(DAY FROM "message".created_at - "user".joined_at) <= 1

    ) u2, (

        SELECT COUNT(*) as number_of_users_in_waitlist FROM "user_waitlist"

    ) u3, (

        SELECT
            COUNT(*) as number_of_transactions,
            COUNT(case has_executed when true then 1 else null end) as number_of_transactions_signed
        from "transaction"
        INNER JOIN "user" ON "user".id = "transaction".created_by
        WHERE "user".access_code_id = 7

    ) u4
;

CREATE MATERIALIZED VIEW mv_user_information
AS
    SELECT
        telegram_id,
        username,
        true as did_user_joined,
        COALESCE(json_agg(ua."address") FILTER (WHERE ua.user_id IS NOT NULL), '[]') AS addresses,
        COALESCE(json_agg(m."message" ORDER BY m.created_at ASC) FILTER (WHERE m.user_id IS NOT NULL), '[]') AS messages
    FROM "user"
    LEFT JOIN "user_address" ua ON ua.user_id = "user".id
    LEFT JOIN "message" m ON m.user_id = "user".id
    WHERE access_code_id = 7
    GROUP BY "user".id

    UNION ALL

    SELECT
        user_id as telegram_id,
        username,
        false as did_user_joined,
        '[]' AS addresses,
        '[]' AS messages
    FROM "user_waitlist"
;

INSERT INTO migrations(script_name, schema_version) VALUES ('4-5.sql', 5);

COMMIT;
