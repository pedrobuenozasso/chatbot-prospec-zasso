# Banco operacional do chatbot

As migrations desta pasta criam somente tabelas prefixadas com `chatbot_`.
Elas não removem nem alteram tabelas de outros sistemas.

O serviço executa migrations pendentes ao iniciar quando
`DATABASE_ENABLED=true`. Cada arquivo aplicado é registrado em
`chatbot_schema_migrations`.

O primeiro conjunto inclui:

- `chatbot_conversations`: estado durável do fluxo;
- `chatbot_messages`: histórico recebido e enviado;
- `chatbot_leads`: qualificação estruturada;
- `chatbot_handoffs`: protocolo e resumo para o comercial.

Esta etapa não exige a extensão `pgvector`.
