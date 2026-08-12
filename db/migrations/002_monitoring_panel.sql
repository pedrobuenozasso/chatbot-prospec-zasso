CREATE TABLE IF NOT EXISTS chatbot_admin_users (
    id uuid PRIMARY KEY,
    email varchar(254) NOT NULL UNIQUE,
    display_name varchar(120) NOT NULL,
    password_hash text NOT NULL,
    totp_secret_encrypted text,
    role varchar(24) NOT NULL CHECK (role IN ('viewer', 'reviewer', 'admin')),
    active boolean NOT NULL DEFAULT true,
    failed_login_count integer NOT NULL DEFAULT 0,
    locked_until timestamptz,
    last_login_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chatbot_admin_users_active_email_idx
    ON chatbot_admin_users (active, email);

CREATE TABLE IF NOT EXISTS chatbot_admin_sessions (
    token_hash char(64) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES chatbot_admin_users(id) ON DELETE CASCADE,
    csrf_hash char(64) NOT NULL,
    ip_fingerprint char(64),
    user_agent_fingerprint char(64),
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS chatbot_admin_sessions_user_expiry_idx
    ON chatbot_admin_sessions (user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS chatbot_admin_audit_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id uuid REFERENCES chatbot_admin_users(id) ON DELETE SET NULL,
    action varchar(64) NOT NULL,
    resource_type varchar(48) NOT NULL,
    resource_fingerprint char(64),
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    ip_fingerprint char(64),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chatbot_admin_audit_created_idx
    ON chatbot_admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS chatbot_admin_audit_actor_idx
    ON chatbot_admin_audit_log (actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chatbot_conversation_reviews (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_key char(64) NOT NULL REFERENCES chatbot_conversations(conversation_key) ON DELETE CASCADE,
    reviewer_user_id uuid REFERENCES chatbot_admin_users(id) ON DELETE SET NULL,
    rating smallint CHECK (rating BETWEEN 1 AND 5),
    labels text[] NOT NULL DEFAULT ARRAY[]::text[],
    notes text,
    status varchar(24) NOT NULL DEFAULT 'reviewed'
        CHECK (status IN ('pending', 'reviewed', 'needs_action', 'resolved')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chatbot_conversation_reviews_conversation_idx
    ON chatbot_conversation_reviews (conversation_key, updated_at DESC);

CREATE TABLE IF NOT EXISTS chatbot_analysis_runs (
    id uuid PRIMARY KEY,
    requested_by uuid REFERENCES chatbot_admin_users(id) ON DELETE SET NULL,
    status varchar(24) NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    period_start timestamptz NOT NULL,
    period_end timestamptz NOT NULL,
    conversation_count integer NOT NULL DEFAULT 0,
    summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    error_code varchar(80),
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS chatbot_analysis_runs_created_idx
    ON chatbot_analysis_runs (created_at DESC);

CREATE TABLE IF NOT EXISTS chatbot_faq_candidates (
    id uuid PRIMARY KEY,
    analysis_run_id uuid REFERENCES chatbot_analysis_runs(id) ON DELETE SET NULL,
    status varchar(24) NOT NULL DEFAULT 'suggested'
        CHECK (status IN ('suggested', 'accepted', 'rejected', 'published')),
    language varchar(16) NOT NULL DEFAULT 'pt-BR',
    question text NOT NULL,
    suggested_answer text,
    reason text NOT NULL,
    evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
    occurrence_count integer NOT NULL DEFAULT 1,
    reviewed_by uuid REFERENCES chatbot_admin_users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chatbot_faq_candidates_status_created_idx
    ON chatbot_faq_candidates (status, created_at DESC);

CREATE TABLE IF NOT EXISTS chatbot_health_snapshots (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    overall_status varchar(16) NOT NULL CHECK (overall_status IN ('healthy', 'degraded', 'down')),
    components jsonb NOT NULL,
    response_time_ms integer,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chatbot_health_snapshots_created_idx
    ON chatbot_health_snapshots (created_at DESC);
