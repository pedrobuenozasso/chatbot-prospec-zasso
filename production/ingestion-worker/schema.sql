-- Schema do banco de conhecimento do chatbot.
-- Rode uma vez: psql "$DATABASE_URL" -f schema.sql
-- (idempotente: pode rodar de novo sem estragar nada)

CREATE EXTENSION IF NOT EXISTS vector;

-- Um registro por ARQUIVO .md ingerido.
CREATE TABLE IF NOT EXISTS documents (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_file    text NOT NULL UNIQUE,   -- caminho relativo, ex: Sales/FAQ/FAQ-018-....md
    faq_id         text,                   -- do frontmatter, ex: FAQ-018
    question       text,                   -- a pergunta canônica do FAQ
    status         text,                   -- Done etc.
    audience       text,                   -- Customer-facing etc.
    evidence_level text,                   -- High | Medium | Low (alimenta o cálculo de confiança)
    file_hash      text NOT NULL,          -- sha256 do arquivo inteiro; se não mudou, pulamos
    ingested_at    timestamptz NOT NULL DEFAULT now()
);

-- Um registro por CHUNK (aqui: uma seção do markdown).
CREATE TABLE IF NOT EXISTS chunks (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    section      text NOT NULL,            -- Short Answer, Caveats, ...
    -- Quem pode "ver" este chunk na resposta final:
    --   public           → pode ser citado na resposta ao cliente
    --   public_suggested → frase pronta de vendas, pode ser reusada quase literalmente
    --   internal         → só orienta o LLM (guardrail); NUNCA vai literal na resposta
    visibility   text NOT NULL CHECK (visibility IN ('public', 'public_suggested', 'internal')),
    content      text NOT NULL,
    content_hash text NOT NULL,            -- sha256 do content (economiza re-embedding)
    embedding    vector(1024),             -- dimensão do bge-m3 (multilíngue); mude junto com o modelo
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- Índice de busca por similaridade (cosseno). HNSW = rápido e bom o suficiente
-- nessa escala (~2 mil chunks); não precisa tunar nada.
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
    ON chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks (document_id);
