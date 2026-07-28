# Núcleo de produção do Chatbot Zasso

Assistente conversacional RAG da Zasso. O MVP atual usa Telegram como canal,
PostgreSQL/pgvector como base de conhecimento e memória, Ollama para embeddings
e o `sacf-ai-worker` como gateway de geração de texto.

## Documentação

- [Comece aqui](docs/START_HERE.md) — transferência, ordem de leitura, estado e
  primeiro dia de quem assumir o projeto.
- [Referência técnica atual](docs/chatbot_documentacao_tecnica_atual.md) —
  fonte de verdade do comportamento implementado, fluxos, dados, operação,
  limitações e roteiro.
- [Arquitetura e decisões](docs/architecture/README.md) — motivos, alternativas
  e consequências das escolhas atuais.
- [Runbooks](docs/runbooks/local-development.md) — execução, teste, parada e
  diagnóstico.
- [Contrato do AI Worker](docs/contracts/ai-worker.md) e
  [contrato de dados](docs/contracts/database.md) — fronteiras que não devem
  depender de conhecimento oral.
- [Índice dos documentos](docs/README.md) — distingue a referência atual dos
  documentos históricos.
- [Dívida técnica](debt.md) — trabalho remanescente, com indicação do nível já
  implementado em cada frente.

## Componentes

- `chatbot-backend/`: atendimento no Telegram, roteamento, memória, retrieval,
  geração, handoff e retenção.
- `ingestion-worker/`: ingestão dos FAQs Markdown, chunking e embeddings.
- `../../knowledge/public-faq/`: fonte documental permitida. Ela contém apenas
  FAQs customer-facing aprovadas e sem `Internal Notes`; o Vault bruto não deve
  ser copiado ou ingerido neste repositório.
- `docker-compose.yml`: PostgreSQL 16 com pgvector no ambiente local.

Consulte a referência técnica antes de alterar o fluxo de mensagens. Antes de
subir dados ao banco, leia também `../../knowledge/POLICY.md`.
