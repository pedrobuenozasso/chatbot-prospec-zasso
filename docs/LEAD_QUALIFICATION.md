# Qualificação comercial do MVP

## Fluxo

1. O lead faz a primeira pergunta.
2. O bot responde à pergunta, com saudação apenas no primeiro contato.
3. Em uma segunda mensagem, pergunta se a atuação é no agronegócio ou em área urbana.
4. Para ambos os segmentos, registra a região/cidade.
5. Para **agro**, coleta cultivo/aplicação e área aproximada em hectares.
6. Para **urbano**, coleta o perfil: prefeitura, prestador de serviços ou outro.
7. Ao concluir, coloca o resumo na fila interna de atendimento.

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

## Fila interna e futura plataforma

O MVP registra o lead qualificado em `.outbox/`, uma fila local ignorada pelo
Git. No produto final, essa fila será substituída pelo banco da plataforma
própria: os usuários do comercial entrarão no painel, verão o histórico e o
resumo estruturado, assumirão a conversa e continuarão o atendimento no mesmo
WhatsApp. Não há dependência nem sincronização com Salesforce.
