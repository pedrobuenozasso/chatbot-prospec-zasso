# Chatbot Zasso

Este repositório reúne dois níveis do mesmo produto:

- o MVP Telegram na raiz, rápido para demonstração e testes de perguntas;
- o núcleo de produção em [`production/`](production/), com PostgreSQL/pgvector,
  ingestão semântica, memória, roteamento e base preparada para a futura troca
  de Telegram por WhatsApp Business.

Os dois compartilham a mesma fonte permitida: `knowledge/public-faq/`.

## Núcleo de produção

O código importado para `production/` é a base de evolução do projeto real. A
importação exclui deliberadamente o Vault bruto e qualquer conteúdo interno.
Antes de executar, siga [`production/docs/START_HERE.md`](production/docs/START_HERE.md),
configure os dois arquivos `.env` a partir dos exemplos e confira
[`knowledge/POLICY.md`](knowledge/POLICY.md).

O filtro de visibilidade no retrieval é obrigatório: somente chunks `public` e
`public_suggested` podem ser entregues ao modelo.

## MVP Telegram

MVP local para responder perguntas comerciais sobre a Zasso no Telegram, usando Ollama e uma base de conhecimento explicitamente aprovada.

## Escopo atual

O bot pode indexar somente os arquivos em `knowledge/public-faq/`. Esta pasta é gerada a partir de `raw_md/Sales/FAQ/` do Vault e não inclui a seção `Internal Notes` dos documentos originais.

Não indexar o Vault inteiro. A política de inclusão e bloqueio está em [knowledge/POLICY.md](knowledge/POLICY.md).

## Preparar a base de conhecimento

Com o arquivo `.rar` disponível, execute:

```bash
./scripts/import-public-faq.sh "/caminho/para/raw_md.rar"
```

O comando importa apenas as FAQs com os metadados `status: Done` e `audience: Customer-facing`. Arquivos auxiliares ou sem essa aprovação são ignorados.

## Executar o RAG

1. Copie `.env.example` para `.env` e informe o token do SACF AI Worker.
2. O MVP usa busca lexical local nas FAQs aprovadas e envia somente os trechos recuperados ao SACF AI Worker pela rota externa `/v1/jobs`.
3. Gere o índice local:

   ```bash
   npm run index
   ```

4. Teste uma pergunta:

   ```bash
   npm run ask -- "O que é a Zasso?"
   ```

O índice é salvo em `.index/` e não é versionado. Recrie-o após modificar as FAQs. A API do worker não oferece embeddings; caso seja disponibilizado um Ollama direto para embeddings, altere `RAG_RETRIEVAL_MODE=semantic` e gere o índice novamente.

No modo lexical, os arquivos `knowledge/query-glossary.*.json` traduzem termos
comerciais e técnicos recorrentes para os termos em inglês presentes nas FAQs.
Há glossários para português brasileiro, alemão, francês e espanhol; as
perguntas originais em inglês são pesquisadas diretamente.

## Canais

O núcleo em `src/agent.mjs` não depende do canal. Telegram e WhatsApp usam a
mesma lógica de RAG, segurança, idiomas, qualificação e handoff.

### Telegram

O conector por long polling já está incluído. Siga o [guia de configuração](docs/TELEGRAM_SETUP.md) quando recuperar o token.
Para conduzir a apresentação, use o [roteiro de demonstração](docs/CEO_DEMO.md).
O bot detecta e mantém o idioma da conversa em português brasileiro, inglês,
alemão, francês ou espanhol. Mensagens curtas durante a qualificação herdam o
idioma já detectado, evitando trocas de idioma indevidas.

### WhatsApp com Evolution API e n8n

A API interna é iniciada com `npm run api`. O workflow importável está em
[`n8n/evolution-whatsapp-zasso.json`](n8n/evolution-whatsapp-zasso.json) e o
passo a passo completo em
[`docs/EVOLUTION_N8N_SETUP.md`](docs/EVOLUTION_N8N_SETUP.md).

O n8n recebe `MESSAGES_UPSERT`, filtra eventos, chama `POST /v1/messages` e
envia as respostas pela Evolution. Nenhuma chave é armazenada no workflow.

O plano do piloto para qualificar leads na sexta e no sábado e encaminhá-los no
domingo está em [WEEKEND_HANDOFF_PILOT.md](docs/WEEKEND_HANDOFF_PILOT.md).

## Qualificação comercial

Após o primeiro atendimento, o MVP coleta o perfil do lead de forma
conversacional e prepara sua entrada na fila interna de atendimento. Ao
concluir, envia ao lead um botão oficial do WhatsApp para falar com a equipe
comercial, mantendo protocolo e resumo já preenchidos sem exibir a URL longa.
O destino é configurado por
`COMMERCIAL_WHATSAPP_NUMBER`, sempre no formato internacional e somente com
dígitos. Veja o fluxo e a configuração em
[LEAD_QUALIFICATION.md](docs/LEAD_QUALIFICATION.md).

## Persistência no Cloud SQL

O serviço Node ativo possui persistência híbrida: PostgreSQL como fonte
durável e volumes locais como contingência durante a implantação. As migrations
criam somente tabelas prefixadas com `chatbot_` e não exigem `pgvector`.

O overlay Docker com Cloud SQL Auth Proxy e o procedimento de instalação estão
em [CLOUD_SQL_SETUP.md](docs/CLOUD_SQL_SETUP.md). Segredos e credenciais de
conta de serviço nunca pertencem ao repositório.

## Segurança

Os guardrails e o checklist antes de abrir o bot além do piloto estão em [docs/SECURITY.md](docs/SECURITY.md). Para validar a recuperação das perguntas principais antes de uma demonstração:

```bash
npm test
```

## Painel de monitoramento

O painel administrativo separado acompanha saúde, conversas, revisões, auditoria e sugestões controladas de FAQ. O acesso é sem senha: um código temporário e descartável é enviado pelo SACF Mail Service somente ao e-mail autorizado. O painel não publica conteúdo automaticamente no RAG. Arquitetura, retenção e implantação estão em [docs/MONITORING_PANEL.md](docs/MONITORING_PANEL.md).

## Segredos

Tokens e configurações locais pertencem a `.env`, que nunca deve ser versionado.
