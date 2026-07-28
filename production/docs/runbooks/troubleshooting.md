# Runbook de diagnóstico

Diagnostique de fora para dentro: processo, canal, banco, worker, Ollama e
qualidade conversacional. Preserve horário, status e IDs; não registre segredos.

## 1. O bot parece continuar ativo

```powershell
Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -match 'python(.exe)? -m bot\.main' } |
  Select-Object ProcessId,Name,CommandLine
```

Primeiro volte ao terminal e use `Ctrl+C`. Se não existir terminal controlável,
confirme o PID e só então:

```powershell
Stop-Process -Id <PID>
```

Ao reiniciar, o advisory lock confirma se outra instância ainda está viva.

## 2. Respostas duplicadas

Verifique, nesta ordem:

1. duas instâncias/processos;
2. lock adquirido no log;
3. reinício após envio, antes de o `offset` avançar;
4. dois tokens/bots apontando para o mesmo fluxo;
5. mensagens duplicadas já persistidas no banco.

O lock resolve concorrência simultânea, não replay após falha. A correção
estrutural é idempotência durável por update/mensagem.

## 3. Banco indisponível

```powershell
docker compose ps
docker logs --tail 200 chatbot-postgres
docker exec chatbot-postgres pg_isready -U postgres -d chatbot
```

Confirme porta `5433`, IPv4 `127.0.0.1`, credenciais e volume. Não recrie o
volume para solucionar uma conexão.

## 4. Base vazia ou retrieval ruim

Contagens somente leitura:

```powershell
docker exec chatbot-postgres psql -U postgres -d chatbot -c "SELECT count(*) AS documents FROM documents;"
docker exec chatbot-postgres psql -U postgres -d chatbot -c "SELECT count(*) AS chunks FROM chunks;"
```

Também confirme:

- `FAQ_DIR` aponta para `raw_md/Sales/FAQ`;
- modelo/dimensão de ingestão e backend são idênticos;
- a pergunta gerou embedding com 1.024 dimensões;
- a distância do resultado ficou dentro do teto atual;
- os documentos esperados realmente fazem parte da coleção ingerida.

Não compense retrieval ruim apenas aumentando `top_k`; inspecione chunks,
consulta canônica e distância.

## 5. AI Worker

Sem autenticação:

```powershell
Invoke-RestMethod https://ai.sacf.io/health
Invoke-RestMethod https://ai.sacf.io/health/ready
```

Com token obtido de forma segura:

```powershell
$headers = @{ Authorization = "Bearer <TOKEN>" }
Invoke-RestMethod https://ai.sacf.io/v1/queue/stats -Headers $headers
```

Interpretação:

- `pending/processing` prolongado: fila, GPU ou job pesado;
- `retry`: falha transitória;
- `dead_letter`: payload não recuperável ou tentativas operacionais esgotadas;
- chatbot em timeout, worker ainda processando: ausência atual de cancelamento.

Nunca cole o token em issue, commit ou captura de tela.

## 6. Resposta termina por `length`

O chatbot deve rejeitar a saída, reduzir contexto/histórico e tentar novamente.
Verifique os metadados das três tentativas. Se todas falharem, a resposta
parcial não deve aparecer no Telegram nem no histórico; o fluxo deve marcar
handoff.

Não adicione um retry infinito nem grave o fragmento para “não perder”. Thinking
e resposta podem compartilhar o orçamento de geração.

## 7. Mensagem extensa, robótica ou repetitiva

Colete:

- entrada atual;
- duas mensagens anteriores;
- ato/plano classificado;
- `rag_query`;
- IDs e seções dos chunks;
- tentativa usada;
- texto antes e depois do sanitizador.

Classifique a causa:

| Sintoma | Causa provável |
|---|---|
| Reação recebe explicação inteira | ato incorreto ou RAG ativado indevidamente |
| Pergunta direta começa com “Legal” | `answer_mode`/prompt não priorizou resposta |
| Conteúdo anterior se repete | continuidade de chunks ou intenção incorreta |
| Saudação não acompanha período | rota social/classificação |
| Electroherb é reintroduzido toda hora | voz, histórico ou sanitização |
| Handoff corta a conversa | composição ou texto de handoff |

Crie um teste de regressão com a conversa mínima. Não ajuste apenas uma frase
literal se o problema é uma classe semântica.

## 8. Telegram não recebe resposta

Verifique:

1. conectividade e token;
2. update chegou ao `bot.main`;
3. typing continua sendo renovado;
4. classificador/job terminou;
5. `sendMessage` retornou erro;
6. Markdown/Unicode ou tamanho foi rejeitado;
7. o processo está bloqueado em outra mensagem, pois o loop é sequencial.

## 9. Incidente e rollback

Uma correção de prompt pode mudar muitas classes ao mesmo tempo. Antes de
rollback:

- preserve logs e exemplo;
- identifique commit e configuração;
- compare teste automatizado;
- não reverta migrations destrutivamente;
- se necessário, pare o bot para evitar novas respostas;
- registre causa, impacto, período, mitigação e ação permanente.
