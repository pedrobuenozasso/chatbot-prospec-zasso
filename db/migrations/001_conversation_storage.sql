CREATE TABLE IF NOT EXISTS chatbot_conversations (
    conversation_key char(64) PRIMARY KEY,
    channel varchar(24) NOT NULL,
    stage varchar(32) NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'active',
    language varchar(16) NOT NULL DEFAULT 'pt-BR',
    state jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chatbot_conversations_status_updated_idx
    ON chatbot_conversations (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS chatbot_messages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_key char(64) NOT NULL
        REFERENCES chatbot_conversations(conversation_key) ON DELETE CASCADE,
    provider_message_fingerprint char(64) NOT NULL,
    direction varchar(8) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    content text NOT NULL,
    language varchar(16),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (conversation_key, provider_message_fingerprint, direction)
);

CREATE INDEX IF NOT EXISTS chatbot_messages_conversation_created_idx
    ON chatbot_messages (conversation_key, created_at);

CREATE TABLE IF NOT EXISTS chatbot_leads (
    conversation_key char(64) PRIMARY KEY
        REFERENCES chatbot_conversations(conversation_key) ON DELETE CASCADE,
    contact_name varchar(120),
    segment varchar(24),
    region text,
    crop_or_application text,
    area_text text,
    area_hectares numeric(14, 2),
    urban_profile varchar(48),
    qualification jsonb NOT NULL DEFAULT '{}'::jsonb,
    qualified_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chatbot_leads_segment_region_idx
    ON chatbot_leads (segment, region);

CREATE TABLE IF NOT EXISTS chatbot_handoffs (
    protocol varchar(40) PRIMARY KEY,
    conversation_key char(64) NOT NULL
        REFERENCES chatbot_conversations(conversation_key) ON DELETE CASCADE,
    status varchar(32) NOT NULL,
    summary jsonb NOT NULL,
    summary_text text,
    destination varchar(32) NOT NULL DEFAULT 'commercial_team',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chatbot_handoffs_status_created_idx
    ON chatbot_handoffs (status, created_at DESC);

