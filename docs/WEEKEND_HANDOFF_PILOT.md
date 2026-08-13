# Piloto de atendimento no fim de semana

## Objetivo

Manter o chatbot atendendo e qualificando leads durante todo o fim de semana,
sem encaminhar conversas ao comercial na sexta-feira ou no sábado. No domingo,
o lead qualificado recebe uma mensagem aprovada pela Meta e pode retomar o
fluxo. Ao interagir, recebe o botão atual para falar com a equipe comercial,
com o resumo preenchido.

Este documento descreve o piloto de 14 a 16 de agosto de 2026. O atendimento
humano será retomado na segunda-feira, 17 de agosto de 2026.

## Regra operacional

| Momento da qualificação | Comportamento |
| --- | --- |
| Segunda a quinta | Encaminhamento atual, sem alteração |
| Sexta e sábado | Qualifica, salva e agenda; não envia o botão comercial |
| Domingo | Encaminhamento atual para novos leads; libera às 18h os leads agendados |
| Depois da liberação | Um toque do lead reabre a janela de atendimento e libera o botão comercial |

Não haverá segunda tentativa automática. Quem não interagir com a mensagem de
domingo continuará visível no painel para decisão humana na segunda-feira.

## Mensagem de sexta e sábado

> Perfeito, já organizei suas informações. Nosso time comercial retoma o
> atendimento na segunda-feira. No domingo, vou te enviar uma opção para
> continuar com a equipe sem você precisar explicar tudo novamente.

O texto deve ser enviado no mesmo idioma usado pelo lead. O piloto inicial será
validado em português brasileiro antes de liberar os demais idiomas.

## Template da Meta

- Nome: `zasso_continuar_atendimento_fds`
- Categoria: Marketing
- Idioma: Português (Brasil)
- Corpo:

  > Seu atendimento com a Zasso está pronto. Toque em
  > “Continuar atendimento” para receber o resumo e seguir com nosso time
  > comercial.

- Botão de resposta rápida: `Continuar atendimento`

O botão é uma resposta rápida, não um link. O toque do usuário abre uma nova
janela de atendimento de 24 horas no número do bot. O bot então envia o botão
dinâmico já existente, que abre o WhatsApp do comercial com o resumo preenchido.

## Critério para não faturar a mensagem de domingo

O envio automático deve ocorrer somente quando:

1. o lead iniciou a conversa por um anúncio Click-to-WhatsApp;
2. o bot respondeu em até 24 horas;
3. a mensagem de domingo é entregue antes do fim da janela gratuita de 72
   horas;
4. o template está aprovado e o status de entrega é registrado.

Para uma conversa iniciada no começo da sexta-feira, domingo às 18h ainda fica
dentro de 66 horas. Isso mantém margem de seis horas em relação ao limite de
72 horas.

### Limitação confirmada na integração atual

A instância `zasso-oficial` usa `WHATSAPP-BUSINESS`, portanto o transporte é a
API oficial da Meta. Entretanto, a versão atual da Evolution remove o objeto
`referral` com `ctwa_clid` ao transformar o webhook oficial em
`messages.upsert`. Uma auditoria sem conteúdo pessoal encontrou 449 mensagens
na instância oficial e nenhuma delas preservava `ctwa`, `referral` ou
`externalAd`.

Por isso, o piloto não deve presumir que todo contato do número veio de anúncio.
Para este fim de semana, a mensagem inicial já configurada no anúncio será a
identificação estável e natural:

> Olá! Posso ter mais informações sobre isso?

O sistema registra essa identificação somente na primeira mensagem e aceita
apenas diferenças de acentuação, maiúsculas, espaços ou pontuação. Mensagens
orgânicas sem o marcador continuam sendo atendidas pelo bot, mas não recebem o
template automático de domingo.

A solução definitiva será receber o webhook da Meta em um gateway próprio,
registrar somente os identificadores mínimos de atribuição e repassar o evento
integral à Evolution. Essa mudança deve ser homologada depois do piloto, pois
altera o ponto de entrada do canal de produção.

## Dados mínimos da fila

- protocolo;
- chave interna da conversa;
- destinatário criptografado;
- idioma;
- origem elegível (`ctwa_marker` ou, futuramente, `ctwa_referral`);
- horário da primeira mensagem e da primeira resposta;
- horário limite da janela gratuita;
- horário programado;
- estado `queued`, `sending`, `sent`, `failed`, `skipped` ou `cancelled`;
- identificador da mensagem retornado pela Meta;
- resultado de entrega e informação de faturamento quando disponibilizada no
  webhook.

O telefone não deve ser salvo em texto puro. A fila usa criptografia
autenticada e chave separada, mantida somente no ambiente da VPS.

## Proteções obrigatórias

- recurso desligado por padrão e controlado por feature flag;
- fuso horário fixo `America/Sao_Paulo`;
- trava de idempotência para impedir envio duplicado;
- limite de uma mensagem de domingo por protocolo;
- nenhuma nova tentativa automática depois de uma entrega confirmada;
- cancelamento se o lead reiniciar, pedir para parar ou já tiver sido
  encaminhado;
- botão de pausa operacional antes de iniciar o disparo;
- relatório final separado por `sent`, `failed`, `skipped` e elegibilidade;
- nenhuma leitura do conteúdo das conversas para decidir faturamento.

## Plano de quinta-feira, 13 de agosto

1. Criar e enviar o template para aprovação na Meta.
2. Ajustar a mensagem inicial do anúncio para incluir o marcador natural.
3. Implementar a fila e a liberação de domingo atrás de feature flag.
4. Testar com números internos, incluindo duplicidade, reinício, resposta ao
   botão e falha da Meta.
5. Fazer backup do workflow publicado e preparar rollback de um comando.
6. Ativar a regra somente depois de o template aparecer como `Aprovado`.

## Acompanhamento do piloto

### Sexta-feira, 14 de agosto

- confirmar que o bot continua respondendo normalmente;
- confirmar que leads elegíveis terminam em `queued`;
- confirmar que nenhum botão comercial é enviado aos leads agendados;
- conferir a fila às 12h e às 18h.

### Sábado, 15 de agosto

- conferir saúde do chatbot, n8n, Evolution e banco;
- validar que não há protocolos duplicados;
- fazer uma simulação interna completa.

### Domingo, 16 de agosto

- fazer prévia da fila às 17h30;
- liberar automaticamente às 18h;
- acompanhar entrega, falhas e respostas até 19h;
- confirmar que o toque no botão produz o CTA comercial com resumo correto.

### Segunda-feira, 17 de agosto

- confirmar que as conversas encaminhadas estão dentro da janela de 24 horas;
- comparar quantidade de qualificados, enviados, entregues, respondidos e
  encaminhados;
- revisar manualmente as falhas antes de qualquer nova automação.

## Critérios de sucesso

- zero mensagens comerciais encaminhadas na sexta e no sábado;
- zero duplicidades;
- 100% dos envios de domingo restritos aos leads marcados como campanha;
- botão comercial com protocolo e resumo corretos;
- nenhum erro 5xx sustentado no chatbot ou no n8n;
- confirmação de não faturamento nas informações de cobrança/entrega da Meta.

## Critérios de interrupção

O piloto deve ser pausado imediatamente se ocorrer qualquer um destes casos:

- template cobrado fora da janela esperada;
- envio a contato não elegível;
- mais de uma mensagem por protocolo;
- taxa de falha acima de 10%;
- indisponibilidade contínua do bot por mais de cinco minutos;
- resumo trocado entre leads ou qualquer indício de exposição de dados.

## Configuração técnica

O chatbot deve receber estas variáveis somente pela VPS:

```dotenv
WEEKEND_HANDOFF_ENABLED=false
WEEKEND_HANDOFF_CAMPAIGN_MESSAGE=Olá! Posso ter mais informações sobre isso?
WEEKEND_HANDOFF_TIMEZONE=America/Sao_Paulo
WEEKEND_HANDOFF_RELEASE_AT=2026-08-16T18:00:00-03:00
WEEKEND_HANDOFF_TEMPLATE_NAME=zasso_continuar_atendimento_fds
WEEKEND_HANDOFF_CLAIM_LIMIT=25
WEEKEND_HANDOFF_ENCRYPTION_KEY=<64 caracteres hexadecimais>
```

A chave é criada na VPS com `openssl rand -hex 32`; ela nunca entra no GitHub,
no workflow ou no painel. Com `WEEKEND_HANDOFF_ENABLED=false`, a API de retirada
da fila sempre devolve uma lista vazia, mesmo que o workflow esteja publicado.

O workflow importável é
[`n8n/weekend-handoff-sunday.json`](../n8n/weekend-handoff-sunday.json). Ele vem
inativo, usa as credenciais já existentes `Zasso Chatbot API` e
`Zasso Meta Cloud API`, processa uma entrega por vez e registra o resultado da
Meta antes de avançar.

## Endpoints operacionais

Todos exigem a mesma autenticação Bearer da API interna do chatbot:

- `GET /v1/weekend-handoffs/status`: contagem por estado, sem telefone;
- `POST /v1/weekend-handoffs/claim`: reserva protocolos elegíveis de forma
  transacional e entrega o telefone descriptografado somente ao n8n;
- `POST /v1/weekend-handoffs/result`: registra `sent` ou `failed` e libera a
  retomada somente depois de a Meta aceitar a mensagem.

Não existe endpoint público para listar telefones, resumos ou textos da fila.

## Ativação

1. Manter o workflow de domingo inativo.
2. Implantar o chatbot com `WEEKEND_HANDOFF_ENABLED=false` e confirmar `/healthz`.
3. Confirmar que a migration `004_weekend_handoff_queue.sql` foi aplicada.
4. Importar o workflow e validar que ele continua inativo.
5. Fazer teste interno do fluxo e do template.
6. Definir `WEEKEND_HANDOFF_ENABLED=true` e recriar somente o container do
   chatbot.
7. Publicar o workflow de domingo.
8. Conferir `GET /v1/weekend-handoffs/status`; antes de sexta, a fila deve estar
   vazia.

## Rollback

1. Despublicar o workflow de domingo.
2. Alterar `WEEKEND_HANDOFF_ENABLED=false` na VPS.
3. Recriar somente o container `zasso-chatbot`.
4. Confirmar que `/v1/weekend-handoffs/claim` devolve `{"items":[]}`.
5. Não apagar a tabela nem os protocolos; os registros ficam disponíveis para
   auditoria e decisão humana na segunda-feira.

O rollback não exige excluir migration, reiniciar o n8n, alterar a Evolution ou
trocar credenciais da Meta.
