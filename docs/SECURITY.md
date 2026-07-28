# Segurança e guardrails do MVP

## Estado atual

O MVP é adequado para demonstração controlada e chat privado autorizado. Ele não deve ser divulgado publicamente antes de existir handoff humano, monitoramento centralizado e revisão de privacidade/LGPD.

## Controles ativos

- **Acesso fechado:** o bot só inicia com `TELEGRAM_ALLOWED_CHAT_IDS` preenchido e atende apenas esses chats.
- **Segredos locais:** tokens ficam em `.env`, ignorado pelo Git.
- **Base permitida:** somente FAQs `Done` e `Customer-facing` entram no índice; `Internal Notes` são removidas durante a importação.
- **Escopo restrito:** RH, roadmap, patentes, produtos internos, feedbacks e outros materiais confidenciais são bloqueados pela política da base.
- **Resposta grounded:** a IA recebe somente trechos recuperados das FAQs públicas e deve recusar quando a confiança é insuficiente.
- **Prompt injection:** padrões comuns de tentativa de alterar instruções são recusados antes de chamar a IA.
- **Abuso:** limite local por chat, mensagem máxima e contexto máximo enviado ao worker.
- **Privacidade operacional:** logs locais usam hashes de pergunta e chat; não gravam o texto da pergunta nem tokens.
- **Erros seguros:** mensagens de erro para o usuário não expõem detalhes de infraestrutura, tokens ou prompts.

## Checklist antes de abrir além do piloto

1. Revogar e recriar tokens que tenham sido compartilhados fora de um cofre de segredos.
2. Mover segredos para um gerenciador apropriado no ambiente de deploy.
3. Adicionar handoff para equipe humana e SLA de atendimento.
4. Centralizar logs, alertas e métricas de perguntas sem resposta.
5. Trocar a recuperação lexical por embeddings multilíngues e avaliação formal de relevância.
6. Definir retenção de conversas, consentimento e processo de exclusão conforme LGPD.
