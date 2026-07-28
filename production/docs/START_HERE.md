# Comece aqui — transferência do Chatbot Zasso

**Data da transferência:** 27/07/2026  
**Estado:** MVP funcional em validação local, não pronto para operação pública  
**Objetivo deste arquivo:** permitir que uma nova pessoa ou agente assuma o
projeto sem depender do histórico do chat que o originou

## 1. Ordem de leitura

Leia nesta ordem:

1. este arquivo;
2. [`chatbot_documentacao_tecnica_atual.md`](chatbot_documentacao_tecnica_atual.md),
   fonte de verdade do comportamento que existe;
3. [`architecture/README.md`](architecture/README.md), decisões e motivos;
4. [`contracts/ai-worker.md`](contracts/ai-worker.md) e
   [`contracts/database.md`](contracts/database.md), fronteiras externas;
5. [`runbooks/local-development.md`](runbooks/local-development.md), para
   executar o sistema;
6. [`quality/acceptance.md`](quality/acceptance.md), para saber o que testar;
7. [`../debt.md`](../debt.md), backlog, riscos e lacunas;
8. [`ownership-and-roadmap.md`](ownership-and-roadmap.md), próximos passos e
   pontos que precisam de dono.

Documentos `doc1_*`, `doc2_*` e `docs/word/` são históricos. Não os use como
fonte de comportamento atual.

## 2. O projeto em um minuto

O Chatbot Zasso responde pelo Telegram a dúvidas sobre a empresa e capina
elétrica. Ele combina:

- um classificador por LLM, que interpreta o ato conversacional;
- regras locais, que controlam o fluxo;
- RAG sobre FAQs Markdown ingeridos em PostgreSQL/pgvector;
- memória curta e estado de idioma por conversa;
- geração de texto por um serviço externo chamado `sacf-ai-worker`;
- handoff registrado no banco, ainda sem entrega real a uma equipe humana.

Ele não é um agente autônomo e não deve inventar fatos fora dos chunks
recuperados. O sistema está mais próximo de um pipeline de atendimento
controlado que de um chat livre.

## 3. Repositórios e diretórios

| Local atual | Papel | Pertence a este repositório? |
|---|---|---|
| `D:\Arquivos\ChatBot\chatbot-backend` | Bot Telegram e regras de conversa | Sim |
| `D:\Arquivos\ChatBot\ingestion-worker` | Ingestão dos FAQs | Sim |
| `D:\Arquivos\ChatBot\raw_md` | Vault de conteúdo; hoje somente uma parte é ingerida | Sim |
| `D:\Arquivos\ChatBot\docker-compose.yml` | PostgreSQL/pgvector local | Sim |
| `D:\Arquivos\Zasso\workers\sacf-ai-worker` | Gateway/fila compartilhado de IA | Não; dependência externa |
| GKE `zasso-ai-cluster`, `us-central1-a` | Ollama/GPU observado na infraestrutura | Não; ambiente externo |

Os caminhos Windows são o snapshot da máquina de transferência. Em outra
máquina, descubra os repositórios equivalentes; não codifique esses caminhos na
aplicação.

## 4. Estado confirmado

Na verificação de 27/07/2026:

- migrations do chatbot estavam em `b61e84c7d2a9`;
- o banco local expunha PostgreSQL na porta `5433`;
- havia 274 documentos e 1.918 chunks, com vetores de dimensão 1.024;
- a suíte do backend possuía 34 testes aprovados;
- o bot tinha proteção por advisory lock contra duas instâncias simultâneas;
- o modelo de geração era omitido pelo chatbot e resolvido pelo worker;
- o worker documentava `gemma4:26b` como modelo padrão efetivo;
- o handoff apenas gravava estado no banco;
- WhatsApp, CRM, console de revisão e notificação humana não existiam.

Isso é um snapshot, não um SLA. Revalide com os comandos dos runbooks.

## 5. Primeiro dia de quem assumir

1. Obtenha os segredos por canal seguro. Eles não estão nesta documentação.
2. Confirme acesso ao Telegram, PostgreSQL, `https://ai.sacf.io` e endpoint de
   embeddings.
3. Suba somente o banco e rode migrations.
4. Rode os testes antes de iniciar o bot.
5. Consulte a contagem de documentos/chunks; não reingira sem necessidade.
6. Inicie uma única instância do bot e faça o roteiro de smoke test.
7. Pare a instância ao terminar.
8. Não limpe conversas ou reingira conteúdo sem resolver o alvo exato.
9. Registre no handoff vivo qualquer divergência entre documentação e ambiente.

## 6. Regras que não podem se perder

- Nunca expor tokens, prompts completos de clientes ou credenciais em logs/docs.
- Não permitir que a LLM decida diretamente ações com efeito externo.
- Não persistir nem enviar saída truncada ou vazia.
- Não prometer contato humano enquanto não houver integração e SLA reais.
- Preservar o idioma persistente e sua política de lock.
- Tratar mensagens do Telegram e jobs de IA como operações potencialmente
  duplicadas até existir idempotência durável.
- Toda alteração de comportamento deve atualizar código, testes, documento
  técnico e `debt.md` no mesmo trabalho.

## 7. Próxima prioridade recomendada

Antes de novos canais, resolver a confiabilidade de entrega:

1. idempotência por `update_id`/`message_id`;
2. handoff humano real, com destino, estado e SLA;
3. timeout com cancelamento do job remoto;
4. observabilidade por turno e por job;
5. teste de integração do fluxo completo.

Em paralelo, corrigir o roteamento de respostas meta-conversacionais como
“posso continuar falando com você enquanto isso?”, que hoje pode ativar RAG e
repetir conteúdo.

## 8. Critério de autonomia da documentação

Uma pessoa deve conseguir, apenas com estes documentos:

- explicar por que o sistema existe e por que foi desenhado assim;
- executar, testar, parar e diagnosticar localmente;
- localizar a implementação de cada etapa de uma mensagem;
- distinguir comportamento atual de intenção futura;
- conhecer contratos de banco e AI Worker sem acessar segredos;
- escolher o próximo trabalho sem depender do histórico desta conversa.

Se uma dessas tarefas exigir conhecimento oral, a documentação está incompleta
e deve ser corrigida antes da mudança correspondente.
