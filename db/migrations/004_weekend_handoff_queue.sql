CREATE TABLE IF NOT EXISTS chatbot_weekend_handoffs (
    protocol varchar(40) PRIMARY KEY
        REFERENCES chatbot_handoffs(protocol) ON DELETE CASCADE,
    conversation_key char(64) NOT NULL
        REFERENCES chatbot_conversations(conversation_key) ON DELETE CASCADE,
    recipient_ciphertext text NOT NULL,
    language varchar(16) NOT NULL DEFAULT 'pt-BR',
    source_type varchar(24) NOT NULL
        CHECK (source_type IN ('ctwa_marker', 'ctwa_referral')),
    first_inbound_at timestamptz NOT NULL,
    free_entry_expires_at timestamptz NOT NULL,
    scheduled_for timestamptz NOT NULL,
    status varchar(24) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'skipped', 'cancelled')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 10),
    meta_message_id varchar(220),
    delivery_status varchar(32),
    billable boolean,
    last_error_code varchar(80),
    claimed_at timestamptz,
    sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (scheduled_for < free_entry_expires_at)
);

CREATE INDEX IF NOT EXISTS chatbot_weekend_handoffs_due_idx
    ON chatbot_weekend_handoffs (status, scheduled_for, free_entry_expires_at);

CREATE INDEX IF NOT EXISTS chatbot_weekend_handoffs_conversation_idx
    ON chatbot_weekend_handoffs (conversation_key, created_at DESC);
