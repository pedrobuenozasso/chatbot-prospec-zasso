# Contrato de dados do chatbot

**Fonte de verdade executável:** migrations em `chatbot-backend/alembic/versions`
e `ingestion-worker/schema.sql`.  
**Snapshot verificado:** 27/07/2026, migration `b61e84c7d2a9`.

Este documento descreve responsabilidades e invariantes. Para tipos e nomes
exatos de todas as colunas, consulte as migrations; não mantenha um segundo
schema manual divergente.

## 1. Domínios de dados

### Conhecimento

- `documents`: identidade e metadados do documento ingerido;
- `chunks`: trechos pesquisáveis, texto, seção, ordem e embedding;
- índice HNSW/cosseno sobre vetores de dimensão 1.024.

Invariantes:

- um chunk pertence a um documento;
- o texto usado para responder deve ser recuperável para auditoria;
- dimensão e modelo de embedding precisam ser compatíveis na ingestão e busca;
- reingestão deve ser idempotente para a mesma fonte/versão.

### Conversa

- `conversations`: estado por `chat_id`, sessão, idioma, handoff e atividade;
- `conversation_messages`: turnos de usuário e assistente;
- `conversation_message_chunks`: referências compactas aos chunks usados;
- campos/metadados de plano permitem auditar a decisão da resposta.

Invariantes:

- uma mensagem pertence a uma conversa;
- só a resposta final aceita deve ser persistida como resposta enviada;
- referências de chunks devem corresponder ao turno que as utilizou;
- idioma e handoff sobrevivem à janela curta entregue à LLM;
- handoff não deve desaparecer por limpeza automática comum.

## 2. O que não pertence a este banco

- fila e jobs do `sacf-ai-worker`;
- pesos ou estado do modelo;
- segredos do Telegram/Ollama;
- estado durável de entrega do Telegram — ainda não implementado;
- fila real de atendimento humano — ainda não implementada.

## 3. Migrations

No backend:

```powershell
cd D:\Arquivos\ChatBot\chatbot-backend
.\venv\Scripts\Activate.ps1
alembic current
alembic upgrade head
```

Regras:

- nunca editar uma migration já aplicada em ambiente compartilhado;
- criar uma nova migration para mudanças;
- revisar downgrade, índices, locks e volume;
- fazer backup antes de migration destrutiva;
- executar testes e comparar `alembic current` com `heads`.

## 4. Limpeza e retenção

A limpeza atual arquiva conversas inativas; ela não implementa deleção completa
ou anonimização. Handoffs são preservados. A limpeza manual usada em testes é
uma operação destrutiva e deve:

1. resolver exatamente o banco e o ambiente;
2. mostrar contagens antes;
3. limitar o alvo ao `chat_id` ou conjunto explicitamente solicitado;
4. usar transação;
5. confirmar contagens depois;
6. nunca apagar documentos/chunks junto com conversa.

O procedimento precisa virar comando administrativo versionado; hoje essa
lacuna permanece no `debt.md`.

## 5. Evoluções obrigatórias

- chave única para deduplicar updates/mensagens do Telegram;
- correlação persistente entre turno e jobs de classificação/geração;
- estados de handoff (`requested`, `queued`, `assigned`, `resolved`, `failed`);
- timestamps e ator de cada transição;
- política formal de retenção, deleção e anonimização;
- estratégia para referências de chunks após reingestão.
