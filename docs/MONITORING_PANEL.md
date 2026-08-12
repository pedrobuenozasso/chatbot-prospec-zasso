# Painel de monitoramento do chatbot

## Objetivo

O `Zasso Monitor` é uma aplicação administrativa separada do canal de atendimento. Ela permite confirmar se os componentes estão saudáveis, consultar as conversas ainda dentro da retenção, revisar falhas e preparar melhorias do RAG sem alterar automaticamente o comportamento do bot.

O painel não participa do caminho crítico das mensagens. Se ele estiver indisponível, o chatbot continua atendendo normalmente.

## O que o painel entrega

- saúde do chatbot, PostgreSQL, n8n, mail service e, opcionalmente, Evolution;
- indicadores de volume, qualificação, respostas de baixa confiança e pendências;
- lista pesquisável de conversas por protocolo, segmento, status e região;
- histórico das mensagens, resumo comercial e referências de FAQ gravadas nas novas respostas;
- revisão humana com nota, observação e rótulos como `muito longa`, `FAQ ausente`, `possível alucinação` e `possível vazamento`;
- fila de sugestões de FAQ produzida por padrões determinísticos e, quando habilitada, revisão assistida por IA;
- trilha de auditoria de login, consulta de conversa, revisão e mudança de acesso;
- administração de usuários e papéis.

## Papéis

| Papel | Permissões |
|---|---|
| Visualizador | Métricas, saúde, conversas e auditoria |
| Revisor | Tudo do visualizador, mais revisão de conversas, análise e decisão sobre sugestões |
| Administrador | Tudo do revisor, mais consulta e desativação de acessos |

O ambiente atual aceita exclusivamente `pedro.bueno@zasso.com.br`. Não existe senha de login: cada nova autenticação exige um código enviado pelo SACF Mail Service para o e-mail autorizado.

## Login por e-mail

1. O usuário informa o e-mail na interface da Vercel.
2. A VPS confirma a lista segura sem revelar ao navegador quais contas existem.
3. Um código aleatório de seis dígitos é armazenado somente como hash e enfileirado pelo SACF Mail Service.
4. O código expira em 10 minutos, funciona uma vez e aceita no máximo cinco tentativas.
5. Novas solicitações são limitadas por usuário e IP.
6. Depois da validação, a VPS cria uma sessão `HttpOnly`; a Vercel nunca recebe SMTP, token do mail service ou credenciais do banco.

## Fluxo de melhoria contínua

1. O painel seleciona no máximo 250 conversas do período solicitado.
2. Telefones, e-mails, CPF e CNPJ são removidos antes de qualquer análise externa.
3. Mensagens do lead são tratadas como conteúdo não confiável; instruções contidas nelas não podem alterar a tarefa de auditoria.
4. A rotina identifica baixa confiança, abandono e perguntas sem cobertura.
5. O resultado entra em `Sugestões de FAQ`.
6. Um revisor aceita ou rejeita a sugestão.
7. Mesmo aceita, a sugestão ainda precisa de uma fonte oficial aprovada para ser transformada em FAQ pública.

Não há autoaprendizado direto nem publicação automática no RAG. Isso evita que uma resposta errada do bot, uma tentativa de prompt injection ou um dado fornecido pelo lead vire “verdade” na base.

## Retenção e privacidade

- texto integral das mensagens: 15 dias, controlado por `MESSAGE_RETENTION_DAYS`;
- estado de conversa inativo: reiniciado depois de 15 dias, controlado por `CONVERSATION_INACTIVITY_DAYS`;
- snapshots de saúde: 90 dias;
- trilha administrativa pseudonimizada: 180 dias;
- número do WhatsApp e IP não são exibidos no painel; identificadores operacionais e IPs de auditoria são armazenados como hash;
- códigos de login nunca são armazenados em texto puro e são eliminados depois de 24 horas;
- tokens de sessão são armazenados somente como hash.

## Proteções da aplicação

- HTTPS pelo Traefik e cookies `Secure`, `HttpOnly` e `SameSite=Strict`;
- código temporário de uso único enviado somente ao e-mail autorizado;
- bloqueio temporário depois de cinco tentativas inválidas e limitação adicional por IP;
- CSRF em todas as operações de escrita;
- CSP restritiva, bloqueio de iframe, MIME sniffing, câmera, microfone e geolocalização;
- limite de 32 KiB por requisição;
- consultas SQL parametrizadas e filtros de papel no servidor;
- auditoria de acesso a cada conversa;
- serviço e container separados do chatbot.

## Configuração

No `.env` privado da VPS:

```dotenv
MONITORING_PASSWORD_PEPPER=<openssl rand -hex 32>
MONITORING_ENCRYPTION_KEY=<openssl rand -hex 32>
MONITORING_REQUIRE_PROXY=false
MONITORING_ALLOWED_EMAILS=pedro.bueno@zasso.com.br
MONITORING_ALLOWED_EMAIL_DOMAIN=zasso.com.br
MONITORING_SESSION_HOURS=8
MONITORING_EMAIL_LOGIN_ENABLED=true
MONITORING_EMAIL_CODE_MINUTES=10
MONITORING_EMAIL_CODE_MAX_ATTEMPTS=5
MONITORING_EMAIL_CODE_MAX_REQUESTS=3
MONITORING_MAIL_SERVICE_URL=http://sacf-mail-service:8015
MONITORING_MAIL_SERVICE_TOKEN=<token interno do mail service>
MONITORING_AUDIT_RETENTION_DAYS=180
MONITORING_HEALTH_RETENTION_DAYS=90
MONITORING_AI_ANALYSIS_ENABLED=false
```

Na implantação atual, a interface fica na Vercel e chama um proxy serverless de origem fixa. Toda autorização, geração do código e integração com o mail service continuam na VPS. A Vercel não recebe credenciais do PostgreSQL, SMTP nem o token do mail service. Opcionalmente, `MONITORING_PROXY_TOKEN` e `MONITORING_REQUIRE_PROXY=true` podem ser adotados depois como uma segunda autenticação entre serviços.

Os dados do PostgreSQL são os mesmos já usados pelo chatbot. O painel nunca deve receber uma chave do navegador; todos os segredos ficam somente no servidor.

## Subida na VPS

Validar a composição sem reiniciar serviços:

```bash
docker compose \
  -f docker-compose.vps.yml \
  -f docker-compose.cloudsql.yml \
  -f docker-compose.monitoring.yml \
  config --quiet
```

Construir e subir somente o painel:

```bash
docker compose \
  -f docker-compose.vps.yml \
  -f docker-compose.cloudsql.yml \
  -f docker-compose.monitoring.yml \
  up -d --build zasso-monitoring
```

O próprio container executa migrations aditivas e idempotentes antes de iniciar.

## Análise assistida por IA

Comece com `MONITORING_AI_ANALYSIS_ENABLED=false`. Nesse modo, a rotina determinística já agrupa perguntas associadas a respostas de baixa confiança. Para ativar a revisão semântica, configure o token do SACF AI Worker apenas na VPS e altere a variável para `true`.

A análise é iniciada manualmente por um revisor no botão `Analisar últimos 7 dias`. O processo roda em segundo plano e não bloqueia o atendimento.

## Operação semanal sugerida

- segunda-feira: executar a análise dos sete dias anteriores;
- revisar primeiro itens de possível vazamento, possível alucinação e qualificação;
- validar sugestões com Comercial/Produto e uma fonte oficial;
- editar a FAQ pública em pull request;
- executar todos os testes e só então reindexar/deployar o RAG;
- comparar na semana seguinte se a ocorrência diminuiu.

## Limitações conhecidas

- mensagens com mais de 15 dias não estarão disponíveis; o resumo comercial e os indicadores podem continuar existindo;
- o painel identifica sinais, mas a decisão de segurança e conteúdo permanece humana;
- alertas operacionais ativos por e-mail/Slack não fazem parte deste primeiro corte; o e-mail já é usado apenas para autenticação e a saúde fica disponível na interface e em `/healthz`.
