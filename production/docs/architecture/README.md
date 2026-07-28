# Arquitetura e decisões

Este diretório explica não só **como** o sistema está montado, mas **por que**.
O comportamento detalhado continua em
[`../chatbot_documentacao_tecnica_atual.md`](../chatbot_documentacao_tecnica_atual.md).

## 1. Visão por camadas

| Camada | Componentes atuais | Decisões permitidas |
|---|---|---|
| Canal | Telegram Bot API, `bot.main` | Receber, indicar digitação e enviar |
| Aplicação | `bot.handler`, `bot.router` | Escolher fluxo, compor, validar e persistir |
| Conversação | classificador, prompts, voz e tom | Interpretar linguagem e redigir dentro de limites |
| Conhecimento | embeddings, retrieval, FAQs | Encontrar evidência relevante |
| Estado | PostgreSQL/pgvector, `bot.memory` | Sessão, idioma, auditoria e handoff |
| Inferência | `sacf-ai-worker`, Ollama | Enfileirar e executar classificação/geração |

O princípio central é: **a LLM interpreta e redige; o backend conserva a
autoridade sobre estado e efeitos**.

## 2. Decisões vigentes

### ADR-001 — RAG controlado pelo backend

**Estado:** aceito no MVP.

**Contexto:** respostas institucionais precisam ser sustentadas pela base,
auditáveis e menos sujeitas a invenção.

**Decisão:** o backend cria o embedding da consulta, busca chunks, monta o
contexto, solicita a geração e valida o resultado. O modelo não navega no vault
nem escolhe ferramentas.

**Consequências positivas:** rastreabilidade, controle de fatos e possibilidade
de trocar o modelo. **Custos:** maior latência, necessidade de calibrar busca e
risco de contexto pobre produzir resposta pobre.

**Alternativas rejeitadas:** prompt único sem RAG; agente com acesso livre aos
arquivos; resposta montada apenas por templates.

### ADR-002 — Router híbrido: LLM para semântica, código para política

**Estado:** aceito, com calibração pendente.

**Contexto:** listas literais funcionam para saudações fechadas, mas falham em
reações e variações naturais. Entregar todo o controle à LLM dificultaria
auditoria e segurança.

**Decisão:** uma chamada estruturada classifica o ato e produz um plano. O
backend normaliza esse plano e escolhe rotas determinísticas: social, reação,
RAG, guardrail ou handoff.

**Consequências:** cobre variação linguística mantendo limites. Adiciona uma
chamada de IA e ainda pode classificar incorretamente intenções
meta-conversacionais.

### ADR-003 — AI Worker como gateway de geração

**Estado:** aceito.

**Contexto:** fila, autenticação, priorização e acesso ao Ollama são
responsabilidades compartilhadas por serviços.

**Decisão:** classificações e gerações usam `sacf-ai-worker`. O chatbot não
declara modelo; aceita o padrão do contrato. Embeddings continuam diretos ao
Ollama porque o worker atual não é a fronteira usada para essa operação.

**Consequências:** isolamento da infraestrutura de geração e modelo
substituível. Há dependência de polling, dois níveis de retry e ausência de
idempotência de job no contrato atual.

### ADR-004 — PostgreSQL como memória e índice vetorial

**Estado:** aceito.

**Contexto:** conversa, auditoria e conhecimento precisam sobreviver ao
processo, enquanto a busca requer similaridade vetorial.

**Decisão:** usar PostgreSQL com pgvector para ambos, em conjuntos de tabelas
distintos. O banco do AI Worker permanece separado.

**Consequências:** uma tecnologia operacional e transações consistentes.
Também concentra impacto de indisponibilidade e exige migrations e retenção
cuidadosas.

### ADR-005 — Telegram por long polling e uma instância

**Estado:** aceito somente para validação do MVP.

**Contexto:** long polling simplifica o ambiente local e a primeira validação.

**Decisão:** um loop sequencial usa `getUpdates`; advisory lock no PostgreSQL
impede duas instâncias ativas.

**Consequências:** implantação simples e sem webhook público. Não escala,
bloqueia novas mensagens durante gerações e não oferece deduplicação durável.
Antes de produção ou múltiplas réplicas, revisar esta decisão.

### ADR-006 — Memória explícita e pequena

**Estado:** aceito, parcialmente endurecido.

**Contexto:** enviar toda a conversa aumenta custo, latência e risco de
contaminação do contexto.

**Decisão:** persistir o histórico completo para auditoria, mas fornecer ao
modelo uma janela curta. Guardar idioma, evidências, sessão, handoff e IDs
compactos de chunks como estado estruturado.

**Consequências:** prompts menores e estado inspecionável. Resumos de longo
prazo e fatos coletados ainda não existem; referências de chunks podem ficar
obsoletas após reingestão.

## 3. Decisões ainda abertas

Exigem responsável e critério antes de implementação:

- webhook versus fila interna para o canal definitivo;
- destino e SLA do handoff humano;
- contrato de idempotência com o AI Worker;
- política de deleção/anonimização e base legal;
- mecanismo de resumo de longo prazo;
- isolamento do domínio conversacional para reutilização no WhatsApp;
- ownership dos prompts e aprovação de conteúdo.

## 4. Quando criar uma nova ADR

Crie uma seção/arquivo de decisão quando uma mudança:

- altera uma fronteira entre serviços;
- introduz armazenamento ou canal novo;
- muda autoridade entre LLM e código;
- cria custo operacional recorrente;
- altera segurança, privacidade ou garantia de entrega.

Registre contexto, decisão, alternativas, consequências, estado e data. Uma ADR
explica o motivo; não substitui a documentação do comportamento.
