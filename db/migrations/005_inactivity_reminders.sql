CREATE TABLE IF NOT EXISTS chatbot_inactivity_reminders (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_key char(64) NOT NULL
        REFERENCES chatbot_conversations(conversation_key) ON DELETE CASCADE,
    recipient_ciphertext text NOT NULL,
    language text NOT NULL DEFAULT 'pt-BR',
    pending_stage text NOT NULL,
    scheduled_for timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'sending', 'sent', 'continued', 'closed', 'cancelled', 'expired', 'failed')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
    meta_message_id text,
    last_error_code text,
    claimed_at timestamptz,
    sent_at timestamptz,
    responded_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS chatbot_inactivity_reminders_open_conversation_idx
    ON chatbot_inactivity_reminders (conversation_key)
    WHERE status IN ('queued', 'sending', 'sent');

CREATE INDEX IF NOT EXISTS chatbot_inactivity_reminders_due_idx
    ON chatbot_inactivity_reminders (status, scheduled_for, created_at);
