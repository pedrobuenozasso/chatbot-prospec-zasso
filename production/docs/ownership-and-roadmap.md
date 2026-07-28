# Ownership, transição e roadmap

## 1. Situação de ownership

Na data desta documentação, a saída do mantenedor atual foi anunciada, mas o
novo responsável técnico, o responsável de produto, o dono do conteúdo e o
destino do handoff ainda precisam ser formalmente confirmados.

Nomes citados em documentos ou conversas históricas não constituem designação
vigente. Registre a decisão abaixo antes de operação:

| Responsabilidade | Pessoa/time | Canal de contato | Backup | Estado |
|---|---|---|---|---|
| Código do chatbot | A confirmar | A confirmar | A confirmar | Aberto |
| AI Worker | A confirmar | A confirmar | A confirmar | Aberto |
| Ollama/GKE/GPU | A confirmar | A confirmar | A confirmar | Aberto |
| PostgreSQL/backup | A confirmar | A confirmar | A confirmar | Aberto |
| Conteúdo e fatos Zasso | A confirmar | A confirmar | A confirmar | Aberto |
| Voz e critérios de qualidade | A confirmar | A confirmar | A confirmar | Aberto |
| Handoff comercial/SAC | A confirmar | A confirmar | A confirmar | Aberto |
| Privacidade/LGPD | A confirmar | A confirmar | A confirmar | Aberto |

## 2. Acessos a transferir

Sem registrar valores secretos neste repositório:

- repositório e processo de revisão;
- bot de teste e BotFather;
- token de serviço do AI Worker;
- endpoint/autorização de embeddings;
- banco local e ambientes compartilhados;
- GCP/GKE/Cloud SQL e logs;
- domínio/TLS do AI Worker;
- origem e aprovação dos FAQs;
- canal futuro de atendimento humano/CRM.

Para cada acesso, registre proprietário, método de concessão, expiração e
procedimento de rotação em cofre corporativo.

## 3. Roadmap recomendado

### Marco A — baseline reproduzível

- novo responsável executa bootstrap e 34 testes;
- smoke test registrado;
- configuração de cada ambiente inventariada;
- CI executa testes e valida docs;
- release/rollback recebem procedimento.

### Marco B — confiabilidade

- idempotência do Telegram;
- correlação de jobs;
- cancelamento em timeout;
- métricas e logs estruturados;
- testes de integração;
- limites de concorrência e latência definidos.

### Marco C — handoff real

- destino operacional;
- estados, fila e ownership;
- mensagem em balão separado;
- SLA somente depois de aprovado;
- falha/reprocessamento e auditoria;
- continuidade do bot enquanto aguarda.

### Marco D — governança conversacional

- suíte sintética multilingue;
- console/processo de revisão;
- versionamento de prompt e conteúdo;
- métricas de groundedness, repetição, handoff e resolução;
- aprovação de mudanças de voz.

### Marco E — canal definitivo

- extrair caso de uso do adaptador Telegram;
- decidir webhook/fila;
- integrar WhatsApp Business;
- consentimento, templates e janela de atendimento;
- CRM/lead somente com contrato e ownership.

## 4. Condições para produção

Não declarar produção antes de:

- dono técnico e operacional definidos;
- idempotência e observabilidade;
- handoff entregue a uma pessoa;
- backup/restore testado;
- política LGPD e retenção aprovada;
- SLOs de disponibilidade/latência;
- teste de carga e falha;
- aprovação do conteúdo;
- runbook de incidente e rollback.

## 5. Registro vivo de transição

Ao assumir, acrescente uma entrada:

```text
Data:
Responsável:
Commit/migration:
Ambiente validado:
Testes:
Riscos aceitos:
Próxima ação:
```

Não apague entradas anteriores; corrija fatos na fonte de verdade e registre a
mudança.
