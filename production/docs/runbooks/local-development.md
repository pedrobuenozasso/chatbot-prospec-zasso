# Runbook de desenvolvimento local

Este runbook parte de Windows + PowerShell + Docker Desktop. Não contém
segredos. Comandos que alteram dados são identificados explicitamente.

## 1. Pré-requisitos

- Git;
- Docker Desktop com Compose;
- Python compatível com as dependências do projeto;
- acesso ao endpoint de embeddings;
- acesso ao `sacf-ai-worker`;
- token de um bot de teste do Telegram;
- PowerShell permitindo ativar o ambiente virtual.

Não é necessário rodar Ollama localmente no desenho atual.

## 2. Configuração

Crie os arquivos a partir dos exemplos:

```powershell
Copy-Item chatbot-backend\.env.example chatbot-backend\.env
Copy-Item ingestion-worker\.env.example ingestion-worker\.env
```

Preencha por canal seguro:

- `TELEGRAM_BOT_TOKEN`;
- `AI_WORKER_SERVICE_TOKEN`;
- URL/autenticação do Ollama de embeddings, se aplicável.

Confirme que backend e ingestão usam exatamente:

- o mesmo `DATABASE_URL`;
- o mesmo `OLLAMA_BASE_URL`;
- o mesmo `EMBEDDING_MODEL`;
- a mesma `EMBEDDING_DIM`.

Uma divergência de modelo pode retornar vetores do tamanho certo, mas de um
espaço semântico diferente e degradar silenciosamente o retrieval.

## 3. Banco local

Na raiz:

```powershell
docker compose up -d postgres
docker compose ps
docker logs --tail 100 chatbot-postgres
```

O mapeamento atual é `127.0.0.1:5433 -> container:5432`. O volume
`chatbot-postgres-data` é persistente. `docker compose down` para o container,
mas preserva os dados; não use `down -v` sem intenção explícita de apagar o
banco.

## 4. Backend

Primeira preparação:

```powershell
cd D:\Arquivos\ChatBot\chatbot-backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
alembic upgrade head
python -m unittest discover -s tests -v
```

Execução:

```powershell
cd D:\Arquivos\ChatBot\chatbot-backend
.\venv\Scripts\Activate.ps1
python -m bot.main
```

O processo deve permanecer aberto. Pare com `Ctrl+C` e aguarde o encerramento.
Não feche o terminal à força durante uma mensagem, salvo incidente.

Se aparecer mensagem de que outra instância possui o lock, localize a instância
existente; não contorne o lock.

## 5. Ingestão

A ingestão não precisa rodar para cada conversa. Execute somente quando os FAQs
mudarem, o banco for recriado ou o modelo/dimensão de embedding mudar.

```powershell
cd D:\Arquivos\ChatBot\ingestion-worker
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m ingest.main
```

Para uma amostra:

```powershell
python -m ingest.main --limit 3
```

Para a base inteira observada:

```powershell
python -m ingest.main --limit 274
```

Não use `--force` como rotina: ele ignora o hash do documento e reprocessa.
Primeiro valide diretório, contagem de arquivos, modelo e banco.

## 6. Smoke test manual

Com banco preenchido e bot iniciado, envie em uma conversa limpa:

1. `/start`;
2. `Oi, boa tarde!`;
3. `Como funciona a capina elétrica?`;
4. `Nossa, que legal!`;
5. `Ela é mais profunda que a capina tradicional?`;
6. `Posso continuar me informando com você enquanto isso?`;
7. `Quero falar com uma pessoa.`

Valide:

- `/start` retorna texto fixo e não grava conversa;
- a saudação acompanha o período;
- a explicação é curta, fundamentada e não repete um tratado de segurança;
- a reação não chama RAG e soa natural;
- a pergunta comparativa começa respondendo diretamente;
- a pergunta meta-conversacional recebe permissão/acolhimento, sem repetir RAG
  — este caso ainda é uma falha conhecida e pode reprovar;
- o pedido explícito marca handoff e não promete prazo inexistente;
- não há mensagens duplicadas.

## 7. Encerramento de uma sessão de teste

1. pare `python -m bot.main` com `Ctrl+C`;
2. confirme que o processo encerrou;
3. mantenha o PostgreSQL ativo se outra pessoa ainda vai usar;
4. limpe conversas somente se o teste seguinte exigir e por procedimento
   controlado;
5. registre falhas com texto de entrada, saída, horário, `chat_id` mascarado e
   metadados do turno — nunca com tokens.

## 8. Mudança mínima segura

Antes de entregar uma alteração:

```powershell
cd D:\Arquivos\ChatBot\chatbot-backend
.\venv\Scripts\Activate.ps1
python -m unittest discover -s tests -v
alembic current
```

Depois, execute o smoke test pertinente, pare o bot e atualize:

- teste automatizado;
- documentação técnica;
- ADR, se a fronteira mudou;
- `debt.md`, removendo ou reclassificando apenas o que realmente foi resolvido.
