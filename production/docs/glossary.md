# Glossário

| Termo | Significado neste projeto |
|---|---|
| Ato conversacional | Categoria semântica do turno, como saudação, reação, pergunta ou handoff |
| AI Worker | Serviço externo que autentica, enfileira e executa chamadas ao modelo de geração |
| Chunk | Trecho de um FAQ usado como unidade de recuperação e evidência |
| Classificador | Chamada estruturada de LLM que produz o plano da resposta |
| Continuidade | Uso controlado do histórico e de chunks anteriores em uma pergunta dependente |
| Dead letter | Estado terminal de um job que não pode ou não conseguiu ser processado |
| Embedding | Vetor numérico que representa semanticamente um texto |
| Finish reason | Motivo informado pelo provider para encerrar a geração, por exemplo `stop` ou `length` |
| Handoff | Pedido/decisão de continuidade com pessoa; hoje é apenas estado no banco |
| Idempotência | Repetir a mesma operação sem criar resposta/job/efeito duplicado |
| Language lock | Idioma persistido após evidência suficiente, evitando oscilações por turno |
| Long polling | Consulta HTTP longa do bot ao Telegram por novos updates |
| Memória | Estado persistido pelo chatbot; não é memória interna da LLM |
| Ollama | Provider que serve modelos de embedding e geração |
| pgvector | Extensão PostgreSQL que armazena e pesquisa embeddings |
| Plano da resposta | JSON normalizado com ato, intenção, rota, consulta RAG e modo de resposta |
| RAG | Recuperação de chunks antes da geração para fundamentar a resposta |
| Reação pura | Comentário emocional sem nova pergunta, resolvido sem retrieval |
| Retrieval | Busca dos chunks mais próximos do embedding da consulta |
| Router híbrido | LLM interpreta linguagem; código valida o plano e escolhe o fluxo |
| Sessão | Segmento temporal de uma conversa; atualmente renova após inatividade |
| Turno | Uma mensagem do usuário e o processamento/resposta correspondente |
| Update | Evento retornado pela Telegram Bot API, identificado por `update_id` |
| Vault | Conjunto amplo de Markdown em `raw_md`; somente a coleção FAQ configurada é ingerida |
