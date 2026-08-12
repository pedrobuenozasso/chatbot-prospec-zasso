# Qualificação comercial do MVP

## Fluxo

1. O lead faz a primeira pergunta.
2. O bot responde à pergunta, com saudação apenas no primeiro contato.
3. Em uma segunda mensagem, pergunta se a atuação é no agronegócio ou em área urbana.
4. Para ambos os segmentos, registra a região/cidade.
5. Para **agro**, coleta cultivo/aplicação e área aproximada em hectares.
6. Para **urbano**, coleta o perfil: prefeitura, prestador de serviços ou outro.
7. Ao concluir, gera um protocolo `ZAS-...`, grava o resumo e entrega ao lead
   um link para continuar no WhatsApp comercial.

O bot faz uma pergunta por vez. Se não conseguir responder a dúvida inicial com
segurança, transforma a resposta em continuidade comercial. Em perguntas sobre
preço, por exemplo, explica que o investimento depende da aplicação e inicia a
qualificação, em vez de apenas recusar a resposta.

Cada mensagem é enviada após um breve indicador de digitação, para que a
conversa mantenha um ritmo natural em vez de disparar perguntas em sequência.

Em cada etapa, uma camada de interpretação valida se a mensagem responde ao
campo solicitado. Se o lead fizer outra pergunta, o bot responde e repete a
mesma pergunta de qualificação; respostas vagas ou fora de contexto não são
salvas como dados do lead.

Quando uma resposta válida é recebida, a próxima pergunta vem com uma
confirmação curta e variável conforme a etapa — por exemplo, “Entendi”,
“Perfeito” ou equivalentes no idioma do lead. Isso dá continuidade sem repetir
saudações nem criar uma sensação mecânica.

Todo o fluxo está localizado em português brasileiro, inglês, alemão, francês
e espanhol. O idioma detectado fica no estado da conversa, por isso respostas
curtas como “agro”, “Weizen” ou “80 hectares” não fazem o bot voltar ao idioma
padrão.

Na etapa de área, o lead também pode responder somente `80`, `100,5` ou outro
número positivo. Como a pergunta já estabelece hectares, o bot acrescenta a
unidade no resumo comercial sem obrigar a pessoa a digitá-la.

Ligações recebidas não alteram o estágio da conversa. Na integração ativa, a
Evolution rejeita a chamada e envia uma mensagem curta pedindo que o lead
escreva no chat. Isso é feito nativamente porque chamadas podem chegar com
identificador privado `@lid`; o workflow mantém suporte a `CALL` apenas como
contingência.

## Retenção e novo contato

O estado de qualificação vale por **15 dias de inatividade**. Depois disso, se
o mesmo número voltar a escrever — mesmo que tenha concluído um handoff antes —
o bot inicia uma nova triagem e gera um novo protocolo quando necessário.

O conteúdo integral de `chatbot_messages` é removido após 15 dias. Métricas
agregadas e o resumo já entregue ao comercial seguem a política comercial
própria; a limpeza não apaga o registro operacional do handoff.

Os valores podem ser ajustados na VPS por `CONVERSATION_INACTIVITY_DAYS`,
`MESSAGE_RETENTION_DAYS` e `RETENTION_SWEEP_INTERVAL_HOURS`.

## Persistência e passagem ao comercial

Durante a transição, o MVP mantém a fila `.outbox/` como contingência e
sincroniza no PostgreSQL:

- estado e idioma em `chatbot_conversations`;
- histórico em `chatbot_messages`;
- campos confirmados em `chatbot_leads`;
- protocolo e resumo em `chatbot_handoffs`.

O número de destino é definido por `COMMERCIAL_WHATSAPP_NUMBER`, no formato
internacional e somente com dígitos. Para o número brasileiro `(11)
96770-2212`, por exemplo, o valor é `5511967702212`.

No WhatsApp oficial, o lead vê um botão curto e localizado para continuar com a
equipe comercial. O botão abre o destino `wa.me` com a mensagem curta já
preenchida em seu idioma, sem exibir a URL longa na conversa. Por segurança do
WhatsApp, ele ainda precisa tocar em **Enviar**.
O resumo inclui somente os campos confirmados:

- segmento e região;
- cultivo/aplicação e área, quando agro;
- perfil de atuação, quando urbano;
- interesse inicial, quando houver algo além de uma saudação;
- protocolo.

Campos ausentes e a conversa completa não são colocados no link. O histórico
continua preservado no banco para auditoria e para a evolução da integração.

Depois que o link é entregue, a triagem é considerada encerrada. Qualquer nova
mensagem recebe somente um lembrete para continuar com o time comercial pelo
link já enviado; o modelo de IA não é consultado novamente. O comando `/reset`
permanece disponível para iniciar uma nova triagem em testes ou quando houver
uma necessidade real de recomeçar.
