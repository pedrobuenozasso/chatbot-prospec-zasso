# Contrato consumido do SACF AI Worker

**Fonte auditada:** repositório externo
`D:\Arquivos\Zasso\workers\sacf-ai-worker`, em 27/07/2026.  
**Endpoint configurado no chatbot:** `https://ai.sacf.io`  
**Segredos:** deliberadamente omitidos

## 1. Responsabilidades

O worker autentica clientes, cria jobs, prioriza, chama o Ollama, mantém
heartbeat, executa retry de falha transitória e persiste o resultado no banco
`ai_worker`. Ele não conhece sessões do Telegram nem decide handoff.

O chatbot:

- envia classificações e gerações;
- acompanha o job por polling;
- interpreta `finish_reason`;
- decide se uma resposta é aceitável;
- realiza suas tentativas conversacionais;
- persiste somente a resposta final aceita.

## 2. Criação e consulta

Fluxo consumido:

```text
POST /v1/jobs -> 202 + job_id
GET /v1/jobs/{job_id} até done, dead_letter ou cancelled
```

Autenticação: `Authorization: Bearer <token de serviço>`.

Envelope mínimo:

```json
{
  "operation": "generate",
  "priority": 2,
  "tenant_label": "Zasso",
  "payload": {
    "messages": [
      {"role": "system", "content": "..."},
      {"role": "user", "content": "..."}
    ],
    "language": "pt-BR",
    "think": false,
    "options": {"temperature": 0.3}
  }
}
```

`priority` varia de 1 a 5 e números menores são processados primeiro.

## 3. Modelo e opções

- `model` é opcional. O chatbot o omite intencionalmente.
- Na auditoria, o padrão do worker era `gemma4:26b`.
- O chatbot não deve assumir esse nome como garantia eterna.
- `think` omitido equivale a `false`; o chatbot envia `false`.
- `options.temperature` do payload prevalece sobre o padrão do worker.
- O chatbot usa `0` para classificação, `0.3` para resposta/reação e `0.2` nas
  tentativas de reparo.
- O chatbot envia `num_ctx: 8192`.
- Na geração principal, o tamanho desejado é instruído no prompt e
  `num_predict` é omitido.

## 4. Estados e resultado

Estados relevantes:

```text
pending -> processing -> done
                    \-> retry -> processing
                    \-> dead_letter
pending/processing -> cancelled
```

Em `done`, o chatbot depende de:

```json
{
  "status": "done",
  "result": {
    "text": "resposta completa",
    "finish_reason": "stop",
    "model": "modelo efetivo"
  },
  "input_tokens": 0,
  "output_tokens": 0
}
```

Os campos de tokens podem ser nulos. `finish_reason: "length"` significa que a
geração terminou por teto e deve ser tratada como incompleta pelo chatbot.

## 5. Dois níveis de tentativa

Não confundir:

| Camada | Tenta novamente quando | Não deve resolver |
|---|---|---|
| AI Worker | rede/provider falha, timeout transitório, job stale | qualidade semântica ou texto truncado aceito pelo provider |
| Chatbot | resultado vazio, `length`, acabamento truncado ou término inválido | indisponibilidade infinita do worker |

O chatbot faz no máximo três gerações: original, reparo 1 e reparo 2. Se nenhuma
é aceitável, encerra com mensagem humana de continuidade e marca handoff.
Nenhuma saída parcial deve ser gravada como resposta do bot.

## 6. Timeout e cancelamento

O chatbot faz polling a cada segundo, com deadline atual de 120 segundos. O
worker oferece `POST /v1/jobs/{job_id}/cancel`, mas o chatbot ainda não o chama.
Portanto, um timeout local pode deixar o job executando e consumindo fila.
Implementar o cancelamento é dívida prioritária.

## 7. Idempotência e segurança conhecidas

No contrato auditado:

- não há `Idempotency-Key` para criação exatamente uma vez;
- repetir `POST /v1/jobs` cria outro job;
- o chatbot não persiste uma chave de job antes de enviar;
- a rota de leitura autentica o serviço, mas o contrato não deve ser tratado
  como autorização por dono do job.

Nunca exponha `job_id` a clientes nem permita que dados entre tenants sejam
consultados pelo bot. Para uma evolução, preferir chave idempotente estável por
`conversation_turn_id + purpose + attempt`.

## 8. Compatibilidade

Antes de atualizar o worker, valide:

- modelo ainda pode ser omitido;
- `result.text` e `result.finish_reason` permanecem;
- prioridades mantêm a mesma ordenação;
- `think:false`, `format` e `options` continuam aceitos;
- os estados terminais não mudaram;
- limites de rate, timeout e payload são compatíveis.

Mudança incompatível exige teste de contrato e atualização deste arquivo.
