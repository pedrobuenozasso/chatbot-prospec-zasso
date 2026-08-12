CREATE TABLE IF NOT EXISTS chatbot_admin_email_codes (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES chatbot_admin_users(id) ON DELETE CASCADE,
    code_hash char(64) NOT NULL,
    request_ip_fingerprint char(64),
    attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chatbot_admin_email_codes_user_created_idx
    ON chatbot_admin_email_codes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS chatbot_admin_email_codes_expiry_idx
    ON chatbot_admin_email_codes (expires_at);
