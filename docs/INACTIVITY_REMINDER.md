# Lembrete de inatividade

## Comportamento

Durante uma triagem ativa no WhatsApp, cada resposta do lead cancela o lembrete
anterior e agenda um novo para 60 minutos depois. Se o lead permanecer sem
responder, o bot envia uma única mensagem com dois botões:

- `Sim, continuar`: confirma a retomada e repete somente a pergunta de
  qualificação que ainda está pendente;
- `Não, encerrar`: encerra a conversa, registra `closed_by_lead` e não agenda
  novas mensagens automáticas.

Não existe segundo lembrete. Se nenhum botão for escolhido, depois de 24 horas
o lead passa silenciosamente para `inactive_lost`. Uma nova mensagem espontânea
do lead reabre uma triagem nova.

## Arquitetura

1. O backend grava a fila em `chatbot_inactivity_reminders`, com o número
   criptografado e apenas um registro aberto por conversa.
2. O workflow `n8n/inactivity-reminder.json` consulta até 25 itens a cada cinco
   minutos usando uma reserva transacional (`FOR UPDATE SKIP LOCKED`).
3. O envio usa os reply buttons oficiais da Meta dentro da janela de atendimento.
4. O workflow registra sucesso ou falha no backend. Uma reserva interrompida
   não é reenviada automaticamente, evitando mensagens duplicadas.
5. Ao receber um clique, o webhook encaminha o ID do botão ao backend. O ID só
   é aceito quando pertence à conversa e a um lembrete ainda aberto.

O número do WhatsApp nunca é armazenado em texto puro nessa fila. Os endpoints
de reserva, resultado e status exigem o mesmo Bearer token interno do chatbot.

## Configuração

```dotenv
INACTIVITY_REMINDER_ENABLED=true
INACTIVITY_REMINDER_MINUTES=60
INACTIVITY_AUTO_CLOSE_HOURS=24
INACTIVITY_REMINDER_CLAIM_LIMIT=25
```

O recurso também exige `DATABASE_ENABLED=true`, `DATABASE_REQUIRED=true` e uma
`WEEKEND_HANDOFF_ENCRYPTION_KEY` válida, reutilizada exclusivamente para cifrar
o destinatário das filas operacionais.

## Rollback

1. Desative o workflow `Zasso | Lembrete de inatividade` no n8n.
2. Defina `INACTIVITY_REMINDER_ENABLED=false` e recrie somente o container
   `zasso-chatbot`.

Os registros existentes permanecem para auditoria e nenhuma tabela precisa ser
apagada.
