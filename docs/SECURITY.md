# Segurança e guardrails do MVP

## Estado atual

O MVP é adequado para demonstração controlada e chat privado autorizado. Ele não deve ser divulgado publicamente antes de existir handoff humano, monitoramento centralizado e revisão de privacidade/LGPD.

## Controles ativos em camadas

- **Acesso fechado:** o bot só inicia com `TELEGRAM_ALLOWED_CHAT_IDS` preenchido e atende apenas esses chats.
- **Segredos locais:** tokens ficam em `.env`, ignorado pelo Git.
- **Base permitida:** somente FAQs `Done` e `Customer-facing` entram no índice; `Internal Notes` são removidas durante a importação.
- **Escopo restrito:** RH, roadmap, patentes, produtos internos, feedbacks e outros materiais confidenciais são bloqueados pela política da base.
- **Resposta grounded:** a IA recebe somente trechos recuperados das FAQs públicas e deve recusar quando a confiança é insuficiente.
- **Prompt injection antes do modelo:** tentativas comuns em português, inglês, alemão, francês e espanhol são normalizadas e recusadas antes do Worker, inclusive durante a qualificação.
- **Isolamento no prompt:** pergunta e evidência ficam em blocos delimitados e são declaradas como dados não confiáveis; nenhuma instrução dentro deles pode alterar o papel do agente.
- **Proteção da saída:** respostas com indícios de token, endpoint, variável de segredo, prompt de sistema ou instrução interna são descartadas e substituídas por uma resposta segura.
- **Saída de rede restrita:** o token do Worker só pode ser enviado por HTTPS ao host `ai.sacf.io`; uma URL diferente é recusada antes da requisição.
- **Abuso:** limite local por chat, mensagem máxima e contexto máximo enviado ao worker.
- **Privacidade operacional:** logs locais usam hashes de pergunta e conversa; não gravam texto nem tokens. O estado usa hash do identificador de Telegram/WhatsApp e não persiste `username` ou telefone em claro.
- **Erros seguros:** mensagens de erro para o usuário não expõem detalhes de infraestrutura, tokens ou prompts.
- **Webhook WhatsApp autenticado:** Evolution, n8n e chatbot usam segredos diferentes; o workflow exportado não contém credenciais.
- **Idempotência:** cada `messageId` é guardado somente como hash e reentregas da Evolution não geram uma segunda resposta.
- **Isolamento de canal:** eventos `fromMe`, grupos, status e newsletters são descartados no n8n antes de chegar ao agente.

## Dados persistidos no piloto

- Estado da conversa: estágio, idioma, primeiro nome e respostas da qualificação.
- Fila de handoff: primeiro nome, segmento, região, cultivo/uso, área ou perfil urbano.
- Eventos: horário, tipo do evento e fingerprints; sem conteúdo bruto.

Esses arquivos ficam em `.state/`, `.outbox/` e `.logs/`, todos ignorados pelo
Git. O primeiro nome e os dados comerciais ainda são dados pessoais ou
potencialmente identificáveis: no ambiente de produção devem ir para banco
criptografado, com acesso por função, retenção definida e trilha de auditoria.

## Limites conhecidos

- Detecção por padrões reduz ataques comuns, mas não prova ausência de prompt
  injection. A defesa principal continua sendo base pública isolada, mínimo
  privilégio, ausência de ferramentas destrutivas e validação da saída.
- O rate limit atual é por processo; em produção deve ser distribuído.
- A fila local não oferece autenticação, criptografia em repouso nem gestão de
  consentimento. Serve somente ao piloto controlado.
- A busca lexical multilíngue cobre termos prioritários. Embeddings
  multilíngues e uma avaliação adversarial contínua são recomendados antes de
  tráfego público.

## Checklist antes de abrir além do piloto

1. Revogar e recriar tokens que tenham sido compartilhados fora de um cofre de segredos.
2. Mover segredos para um gerenciador apropriado no ambiente de deploy.
3. Adicionar handoff para equipe humana e SLA de atendimento.
4. Centralizar logs, alertas e métricas de perguntas sem resposta.
5. Trocar a recuperação lexical por embeddings multilíngues e avaliação formal de relevância.
6. Definir retenção de conversas, consentimento e processo de exclusão conforme LGPD.
7. Aplicar criptografia em repouso, RBAC, auditoria e rotação automática de segredos.
8. Executar testes adversariais periódicos de jailbreak, exfiltração e dados fora do escopo.
