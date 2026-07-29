# Conectar o bot ao Telegram

## 1. Criar o bot

1. No Telegram, abra **@BotFather**.
2. Envie `/newbot`.
3. Defina o nome visível e um usuário terminado em `bot`.
4. Copie o token entregue pelo BotFather. Ele é secreto: não envie em chats, commits ou capturas de tela.

## 2. Configurar o ambiente local

Na pasta do projeto:

```bash
cp .env.example .env
```

Edite `.env` e informe ao menos:

```dotenv
TELEGRAM_BOT_TOKEN=cole_o_token_aqui
SACF_AI_BASE_URL=https://ai.sacf.io
SACF_AI_SERVICE_TOKEN=token_do_servico_externo
SACF_AI_MODEL=qwen2.5:14b
RAG_RETRIEVAL_MODE=lexical
```

Para restringir o piloto ao seu chat, obtenha primeiro o seu ID com um bot de consulta de ID, como `@userinfobot`, e configure:

```dotenv
TELEGRAM_ALLOWED_CHAT_IDS=seu_chat_id
```

O bot não inicia se essa variável estiver vazia e não registra IDs reais no terminal.

## 3. Criar e testar o índice

```bash
npm run index
npm run ask -- "O que é a Zasso?"
```

Revise as fontes retornadas antes de ligar o Telegram.

## 4. Iniciar o bot

```bash
npm run telegram
```

Abra o bot no Telegram, envie `/start` e depois perguntas reais. Esta versão usa long polling, portanto não requer domínio público nem webhook para o piloto local.

## Segurança do piloto

- Mantenha `.env` fora do Git.
- Deixe `TELEGRAM_ALLOWED_CHAT_IDS` preenchido antes de compartilhar o usuário do bot.
- O bot externo usa somente `/v1/jobs`; `/v1/chat/completions` é reservado ao n8n.
- Recrie o índice sempre que alterar as FAQs permitidas.

## Reiniciar uma conversa de teste

Envie `/reset`, `/reiniciar` ou `/start` ao bot para apagar o estado de
qualificação daquele chat e começar novamente. Isso é útil antes de testar um
novo fluxo sem reaproveitar segmento, região ou outras respostas anteriores.
