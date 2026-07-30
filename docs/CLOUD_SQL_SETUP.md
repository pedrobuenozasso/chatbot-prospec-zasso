# Cloud SQL do chatbot

## O que esta integração armazena

O banco operacional registra o estado da conversa, mensagens, qualificação e
handoff. Todas as tabelas têm o prefixo `chatbot_`; a migration é aditiva e não
remove nem altera tabelas externas.

O banco pode começar vazio. A primeira inicialização cria:

- `chatbot_schema_migrations`;
- `chatbot_conversations`;
- `chatbot_messages`;
- `chatbot_leads`;
- `chatbot_handoffs`.

Esta etapa não exige `pgvector`.

## Conectividade recomendada

O chatbot roda em uma VPS fora do Google Cloud. O deployment usa o
[Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/connect-auth-proxy)
como sidecar e não publica a porta do PostgreSQL no host.

O Proxy precisa de:

1. uma conta de serviço com `roles/cloudsql.client`;
2. acesso de rede da VPS à instância;
3. Public IP habilitado na instância, ou uma rota privada/VPN entre a VPS e a
   VPC do Google Cloud.

O Proxy autentica e criptografa o transporte, mas não cria sozinho uma rota
para uma instância disponível exclusivamente por Private IP.

## Segredos na VPS

Crie a pasta:

```bash
mkdir -p /docker/zasso-chatbot/secrets
chmod 700 /docker/zasso-chatbot/secrets
```

Coloque a credencial da conta de serviço em:

```text
/docker/zasso-chatbot/secrets/cloudsql-service-account.json
```

Proteja o arquivo:

```bash
chmod 600 /docker/zasso-chatbot/secrets/cloudsql-service-account.json
```

Não envie esse JSON pelo chat e não o adicione ao Git.

No arquivo `/docker/zasso-chatbot/.env`, configure:

```env
CLOUDSQL_INSTANCE_CONNECTION_NAME=projeto:regiao:instancia
CLOUDSQL_DB_NAME=zasso_chatbot
CLOUDSQL_DB_USER=sacf_chatbot
CLOUDSQL_DB_PASSWORD=SENHA_REAL
CLOUDSQL_DB_SCHEMA=public
CLOUDSQL_CREDENTIALS_FILE=./secrets/cloudsql-service-account.json

DATABASE_REQUIRED=false
```

`DATABASE_REQUIRED=false` mantém o armazenamento local como contingência
durante o primeiro teste. Depois da validação, use `true` para impedir que uma
instância sem banco aceite tráfego silenciosamente.

## Ativação controlada

Não use somente o compose base. Ative o overlay:

```bash
cd /docker/zasso-chatbot
docker compose \
  -f docker-compose.vps.yml \
  -f docker-compose.cloudsql.yml \
  up -d --build
```

O chatbot se conecta a `cloud-sql-proxy:5432`. A porta não é exposta à
internet nem à interface da VPS.

## Verificação

Confirme os containers:

```bash
docker compose \
  -f docker-compose.vps.yml \
  -f docker-compose.cloudsql.yml \
  ps
```

O healthcheck da API mostra apenas o estado da persistência, sem credenciais:

```json
{
  "persistence": {
    "enabled": true,
    "ready": true,
    "required": false,
    "error": null
  }
}
```

No explorador do Cloud SQL, confirme que existem somente as tabelas
`chatbot_*`. Depois envie uma conversa de teste e verifique:

```sql
SELECT stage, status, language, updated_at
FROM chatbot_conversations
ORDER BY updated_at DESC
LIMIT 10;

SELECT segment, region, area_hectares, urban_profile, updated_at
FROM chatbot_leads
ORDER BY updated_at DESC
LIMIT 10;
```

Os identificadores externos são armazenados como hash; o número bruto do
WhatsApp não é gravado nessas tabelas.

## Retorno seguro

Se o PostgreSQL não responder durante o piloto e
`DATABASE_REQUIRED=false`, o chatbot continua usando os volumes locais. Para
desativar o overlay, volte ao compose base somente após confirmar o estado com
a equipe responsável pela VPS.
