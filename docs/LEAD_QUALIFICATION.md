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
segurança, usa um fallback cuidadoso e ainda inicia a qualificação.

## Fila interna e futura plataforma

O MVP registra o lead qualificado em `.outbox/`, uma fila local ignorada pelo
Git. No produto final, essa fila será substituída pelo banco da plataforma
própria: os usuários do comercial entrarão no painel, verão o histórico e o
resumo estruturado, assumirão a conversa e continuarão o atendimento no mesmo
WhatsApp. Não há dependência nem sincronização com Salesforce.
