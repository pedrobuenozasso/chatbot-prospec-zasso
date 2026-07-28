# Dívida técnica

Este arquivo registra o que ainda falta em frentes que podem já ter uma base
implementada. “Dívida” aqui não significa necessariamente “nada foi feito”.

## Resumo de implementação

| Frente | Estado atual | Já existe | Permanece como dívida |
|---|---|---|---|
| Limpeza e retenção | Parcial — MVP funcional | comando, scheduler, arquivamento e preservação de handoffs | política formal, encerramento de handoff, métricas e scheduler externo |
| Review Console | Não implementado | decisão arquitetural e requisitos registrados | confiança por resposta, fila e interface de revisão |
| Raciocínio no AI Worker | Não implementado no worker | investigação e medições dos modos atuais | modos reais `on`/`hidden`/`off` pela API adequada |
| Router e relevância | Parcial — MVP funcional | classificação por LLM, fluxos por ato e limiar vetorial | corpus versionado e calibração por idioma/modelo |
| Naturalidade pragmática | Parcial | regras para saudação, incompreensão, confirmação e handoff separado | regressão de diálogos e validação geral de abertura/encerramento |
| Memória, sessão e idioma | Parcial — MVP funcional | janela, sessões, persistência, lock de idioma e metadados do turno | configuração, cobertura multilíngue e concorrência por chat |
| Disponibilidade e idempotência | Parcial | `finish_reason`, retries limitados, reparos e fallback humano | métricas, diagnóstico de 500 e idempotência durável ponta a ponta |
| Classificação de chunks internos | Não implementado | risco atual auditado | separar `public`, `guardrail` e `confidential` se surgirem dados sensíveis |

## Limpeza e retenção de conversas — hardening de produção

**Status:** implementado no MVP. Além do comando standalone
`python -m bot.cleanup [--dry-run]`, o processo do bot executa o job
automaticamente a cada `CLEANUP_INTERVAL_HOURS` (24h por padrão). Conversas
inativas há mais de `CLEANUP_INACTIVE_DAYS` (7 dias) são arquivadas; handoffs
pendentes são preservados.

**O que ainda falta para produção:**
1. Confirmar formalmente os prazos de 7 dias/24 horas com a política de retenção.
2. Definir como encerrar um handoff; sem isso, um flag pendente pode preservar
   a conversa indefinidamente.
3. Exportar métricas e criar alerta para falhas consecutivas.
4. Considerar um scheduler externo se o processo do bot não operar 24x7.

**Critério de conclusão:** política aprovada, encerramento de handoff definido e
alerta operacional verificável.

**Quando revisitar:** antes de expor o bot a clientes reais ou manter histórico
de conversas por mais de uma semana.

## Review Console ausente (guardrail humano antes do envio)

**Status:** MVP roda sem revisão humana — toda resposta do LLM vai direto pro Telegram, independente do `evidence_level` dos chunks usados.

**Por quê:** decisão consciente pra acelerar a validação do bot no MVP. A arquitetura original previa uma Review Console (humano aprova/edita antes do envio), mas construir isso antes de saber se o RAG básico funciona seria otimização prematura.

**Risco:** uma resposta gerada a partir de chunks `evidence_level: Low` (4 dos 274 FAQs) ou com baixa confiança de busca pode sair sem qualquer checagem humana.

**O que falta:**
1. Calcular uma confiança por resposta (ex: combinar `evidence_level` dos chunks usados + distância da busca vetorial).
2. Fila/tela de aprovação para respostas abaixo de um limiar de confiança.
3. Decidir o limiar e o fluxo de fallback (bot segura a resposta? manda algo genérico enquanto espera? faz handoff direto pro humano?).

**Quando revisitar:** depois que o bot estiver respondendo de forma consistente no Telegram em teste interno — antes de qualquer exposição a cliente real.

## sacf-ai-worker: controle real de raciocínio (on/hidden/off)

**Status:** hoje só existe um controle binário e que não controla o que promete. `reasoning:true/false` no payload só afeta se o texto do raciocínio aparece formatado na resposta da ponte síncrona — não desliga a geração do raciocínio em si (confirmado: `output_tokens` praticamente igual com a flag `true` ou `false`). Testado também `options.think:false` como passthrough — não funciona, o worker fala com o Ollama pela camada OpenAI-compatible, que não repassa esse controle.

**Por quê não mexer agora:** o único jeito que testamos e que desliga o raciocínio de verdade é a API **nativa** do Ollama (`/api/chat`, não `/v1/chat/completions`), fora do que o `sacf-ai-worker` usa hoje. Fazer o `chatbot-backend` chamar isso direto bypassaria o worker inteiro (fila, prioridade, retry, sanitização de log, allowlist) — decisão consciente de não fazer isso (ver `ai_worker_observations.md`).

**O que falta (melhoria no worker, não no chatbot-backend):** em vez de um `reasoning:true/false` que não desliga nada, o `sacf-ai-worker` devia expor três modos reais:
1. **`on`** — raciocínio gerado E exposto na resposta (equivalente ao `reasoning:true` de hoje).
2. **`hidden`** — raciocínio gerado mas não exposto (equivalente ao comportamento atual "padrão", que é o que a maioria dos consumidores quer — mas hoje isso não desliga o custo de tokens, só esconde).
3. **`off`** — raciocínio desligado na origem (repassando `think:false` pro Ollama nativo) — sem custo de tokens extra, sem latência extra. É o modo que faltou pro `chatbot-backend` poder escolher.

Isso exige o worker trocar (ou complementar) seu cliente Ollama pra falar com `/api/chat` nativo quando o modo `off` for pedido, em vez de só `/v1/chat/completions`.

**Medido, pra dimensionar o ganho:** `think:true` → 216 tokens/2.69s; `think:false` nativo → 3 tokens/0.18s (mesmo prompt trivial). Ou seja, o modo `off` de verdade é ~15x mais rápido/barato nesse caso — não é ganho marginal.

**Quando revisitar:** se o custo de GPU do `qwen3:14b` (~2.6x mais tokens que `qwen2.5:14b`) virar problema real em produção, ou se a latência (+5-6s hoje) deixar de ser tolerável.

## Calibração do roteamento e da relevância

**Status:** implementado no MVP. A LLM classifica o ato conversacional antes da
busca; saudações, reações, pedidos de humano, mensagens fora de assunto e
tentativas de extração têm fluxos próprios. Perguntas passam por limiar de
distância e o Telegram renova o indicador de “digitando”.

**O que ainda falta:** calibrar o limiar atual (`0.5`) com um conjunto versionado
de mensagens reais, incluindo falsos positivos e negativos por idioma. Hoje o
número é sustentado por uma amostra manual pequena.

**Quando revisitar:** antes do piloto externo e sempre que a base de FAQs ou o
modelo de embeddings mudar.

## Naturalidade pragmática na continuidade e no encerramento do turno

**Status:** o MVP já separa resposta técnica e aviso de handoff em balões
distintos, oferece tópicos somente quando o plano do turno pede isso e contém
proteções locais para alguns casos recorrentes de saudação, incompreensão e
perguntas confirmatórias. Ainda aparecem respostas semanticamente aceitáveis,
mas inadequadas ao ato conversacional imediato.

**Exemplos observados em conversa real:**
1. “Posso continuar me informando contigo enquanto isso?” recebeu
   “Exatamente...”. A informação posterior estava correta, mas a abertura
   natural seria “Claro!” ou “Com certeza!”; “Exatamente” responde como se o
   cliente tivesse feito uma afirmação.
2. Perguntas finais, convites ou menus podem destoar quando não criam um próximo
   passo útil, repetem algo já oferecido ou aparecem depois de uma resposta que
   já encerrou naturalmente o ponto.
3. Mensagens compostas podem conter entusiasmo e dificuldade ao mesmo tempo;
   nesses casos, acolher “não entendi” deve ter precedência sobre repetir
   “Legal!”.

**O que ainda falta:**
1. Criar um conjunto versionado de diálogos reais para regressão pragmática,
   cobrindo pergunta de permissão, confirmação parcial, incompreensão,
   agradecimento, aceitação de oferta e continuidade depois do handoff.
2. Validar o início da resposta contra o ato do turno: pergunta de permissão
   pede confirmação direta; pedido de nova explicação pede acolhimento; uma
   ressalva não deve esconder a resposta principal.
3. Validar o encerramento: só renderizar pergunta final quando
   `followup_mode` indicar um próximo passo relevante e ainda não respondido.
4. Preferir regras estruturais e metadados do turno a ampliar indefinidamente
   listas de frases literais.

**Critério de conclusão:** lote de regressão aprovado sem aberturas
pragmaticamente incompatíveis e sem perguntas finais redundantes ou deslocadas.

**Quando revisitar:** antes do piloto externo e a cada novo lote de conversas
humanas revisadas.

## Memória, sessão e idioma

**Status:** implementado no MVP. O bot usa uma janela de seis mensagens dentro
da sessão corrente, abre nova sessão após três horas de inatividade, preserva o
idioma entre sessões e trava o idioma após três mensagens com evidência
consistente. Uma troca natural exige duas evidências; um pedido explícito troca
imediatamente. Chunks usados são armazenados como referências compactas
(`chunk_id`, `content_hash`, ordem e distância), não como cópias completas.
Mensagens do assistente também persistem o plano estruturado do turno
(`answer_depth`, `core_goal`, `followup_mode`, `offered_topics`, `warmth` e
`terminology_level`), evitando reconstruir escolhas apenas a partir do texto.

**O que ainda falta:**
1. Transformar os limiares de sessão/idioma em configuração caso os testes de
   uso real indiquem outra cadência.
2. Cobrir com respostas prontas todos os idiomas aceitos pelo classificador; os
   fluxos RAG e de reação já respeitam o idioma, mas alguns fallbacks sociais
   ainda usam português.
3. Avaliar processamento concorrente por chat quando o volume justificar. O
   pool do PostgreSQL já elimina a abertura de uma conexão por operação, mas o
   long polling principal continua sequencial.

**Quando revisitar:** após coletar conversas reais suficientes para medir troca
de idioma, retomada depois de pausa e latência sob múltiplos chats.

## Disponibilidade e observabilidade do AI Worker

**Status:** durante o replay de 24/07/2026, o worker devolveu erros HTTP 500
intermitentes tanto na criação quanto na consulta de jobs. O chatbot agora
consome `finish_reason`, rejeita texto vazio, `length` e frases visivelmente
interrompidas antes de enviar ou persistir. A geração tem no máximo três
submissões (original + dois reparos); se nenhuma produzir uma resposta completa,
a pergunta é registrada para handoff humano, sem contaminar a memória com os
rascunhos parciais. O tamanho da resposta é controlado pelo prompt, não por um
`num_predict` que possa cortar a frase.

O `POST /v1/jobs` não é repetido em HTTP 5xx, read/write timeout ou outra falha
ambígua: o worker pode ter persistido o job e perdido somente a resposta.
Somente `ConnectError`/`ConnectTimeout`, anteriores ao estabelecimento da
conexão, têm retry local. O polling por `GET` continua podendo ser repetido,
pois consultar o mesmo `job_id` é idempotente.

**O que ainda falta:**
1. Métrica de taxa de erro/latência por operação, alerta para falhas consecutivas
   e diagnóstico da causa dos HTTP 500 no próprio worker.
2. Idempotência durável por mensagem/etapa no chatbot (`channel`,
   `external_message_id`, estágio e hash do payload), para retomar um `job_id`
   conhecido após reinício sem gerar novamente.
3. Idempotência exatamente uma vez no AI Worker (`Idempotency-Key` + unicidade
   por cliente). Sem participação do receptor, permanece inevitável a janela em
   que o worker cria o job, a resposta `202` se perde e o chatbot não consegue
   descobrir o `job_id`.
4. Persistir e deduplicar `update_id`/`message_id` do Telegram; o lock impede
   duas instâncias simultâneas, mas não resolve reentrega após queda/reinício.

**Quando revisitar:** antes do piloto externo; retries reduzem impacto, mas não
substituem corrigir a origem da indisponibilidade.

## Chunks `internal` sem separar guardrail de dado confidencial

**Status:** a visibilidade `internal` hoje mistura duas coisas diferentes: instrução de guardrail (“não afirme que todo produto é certificado”) e, em tese, dado sensível (preço, cliente). **Verificado no banco: hoje não existe nenhum chunk `internal` com dado numérico sensível de fato** (`grep` por padrões de preço retornou zero) — o conteúdo real é 100% instrução/proveniência de fonte, não segredo embutido. Ou seja, o risco é arquitetural/preventivo, não um vazamento que já existe.

**O que falta, se for feito:** trocar a visibilidade binária `public/internal` por três níveis (`public`, `guardrail`, `confidential`), onde `confidential` nunca entraria no prompt do modelo público — só faria sentido se algum FAQ novo passar a ter dado sensível embutido de verdade.

**Quando revisitar:** baixa urgência — só fica importante se o conteúdo dos FAQs mudar pra incluir dados realmente sensíveis (preço, nome de cliente) dentro do texto.
